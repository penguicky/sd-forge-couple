"""
Parameter Paste Hook for Forge Couple Shadow DOM Integration

This module hooks into the WebUI's parameter paste system to detect forge couple
advanced mode data and send it directly to the shadow DOM via a global bridge.
"""

import json
import logging
from typing import Dict, Any, Optional

import gradio as gr
from modules import scripts, shared
from modules.infotext_utils import PasteField

logger = logging.getLogger(__name__)


class ForgeCoupleParameterPasteHook:
    """Hooks into the parameter paste system to handle forge couple data"""
    
    def __init__(self):
        self.original_paste_functions = {}
        self.hooked = False
        
    def hook_paste_system(self):
        """Hook into the parameter paste system"""
        if self.hooked:
            return
            
        try:
            # Import the parameter paste module
            from modules import infotext_utils as parameters_copypaste
            
            # Store original connect_paste function
            if hasattr(parameters_copypaste, 'connect_paste'):
                self.original_connect_paste = parameters_copypaste.connect_paste
                parameters_copypaste.connect_paste = self.hooked_connect_paste
                logger.info("[ForgeCouple] Successfully hooked parameter paste system")
                self.hooked = True
            else:
                logger.warning("[ForgeCouple] Could not find connect_paste function to hook")
                
        except Exception as e:
            logger.error(f"[ForgeCouple] Failed to hook parameter paste system: {e}")
    
    def hooked_connect_paste(self, button, paste_fields, input_comp, override_settings_component, tabname):
        """Hooked version of connect_paste that intercepts forge couple data"""
        
        # Create our custom paste function
        def custom_paste_func(params):
            # First, check if this contains forge couple data
            forge_couple_data = self.extract_forge_couple_data(params)
            
            if forge_couple_data:
                # Send to global bridge
                self.send_to_global_bridge(forge_couple_data, tabname)
            
            # Call the original paste function logic
            return self.original_paste_func_logic(params, paste_fields, override_settings_component, tabname)
        
        # Set up the button click with our custom function
        button.click(
            fn=custom_paste_func,
            inputs=[input_comp],
            outputs=[x[0] for x in paste_fields],
            show_progress=False,
        )
        
        # Also set up the JS recalculate function
        button.click(
            fn=None,
            _js=f"recalculate_prompts_{tabname}",
            inputs=[],
            outputs=[],
            show_progress=False,
        )
    
    def extract_forge_couple_data(self, params: str) -> Optional[Dict[str, Any]]:
        """Extract forge couple data from parameter string"""
        if not params or not isinstance(params, str):
            return None
            
        try:
            # Look for forge_couple_mapping in the parameters
            lines = params.split('\n')
            for line in lines:
                if line.strip().startswith('forge_couple_mapping:'):
                    # Extract the JSON data
                    json_part = line.split(':', 1)[1].strip()
                    mapping_data = json.loads(json_part)
                    
                    return {
                        'mapping': mapping_data,
                        'source': 'parameter_paste',
                        'original_params': params
                    }
                    
        except Exception as e:
            logger.error(f"[ForgeCouple] Error extracting forge couple data: {e}")
            
        return None
    
    def send_to_global_bridge(self, forge_couple_data: Dict[str, Any], tabname: str):
        """Send forge couple data to the global bridge via JavaScript"""
        mode = 't2i' if tabname == 'txt2img' else 'i2i' if tabname == 'img2img' else None
        
        if not mode:
            return
            
        # Create JavaScript to send data to global bridge
        js_code = f"""
        (function() {{
            if (window.forgeCoupleGlobalPasteBridge) {{
                console.log('[ForgeCouple] Sending data to global bridge for {mode}');
                window.forgeCoupleGlobalPasteBridge.setPasteData(
                    '{mode}',
                    {json.dumps(forge_couple_data['mapping'])},
                    {{
                        source: '{forge_couple_data['source']}',
                        tabname: '{tabname}',
                        timestamp: Date.now()
                    }}
                );
            }} else {{
                console.warn('[ForgeCouple] Global paste bridge not available');
            }}
        }})();
        """
        
        # Execute the JavaScript
        # Note: We need to find a way to execute this JS in the browser context
        # For now, we'll store it and let the frontend pick it up
        self.store_js_for_execution(js_code, mode)
    
    def store_js_for_execution(self, js_code: str, mode: str):
        """Store JavaScript code for execution by the frontend"""
        # Store in shared state for frontend to pick up
        if not hasattr(shared, 'forge_couple_pending_js'):
            shared.forge_couple_pending_js = {}
            
        shared.forge_couple_pending_js[mode] = js_code
        logger.info(f"[ForgeCouple] Stored JS for execution in {mode} mode")
    
    def original_paste_func_logic(self, params, paste_fields, override_settings_component, tabname):
        """Recreate the original paste function logic"""
        from modules.infotext_utils import parse_generation_parameters, get_override_settings
        
        vals = {}
        
        try:
            # Parse the generation parameters
            parsed_params, _ = parse_generation_parameters(params)
            
            # Process each paste field
            for field, name in paste_fields:
                if name in parsed_params:
                    vals[field] = parsed_params[name]
                elif hasattr(field, 'value'):
                    # Keep existing value if parameter not found
                    vals[field] = field.value
                else:
                    vals[field] = None
                    
        except Exception as e:
            logger.error(f"[ForgeCouple] Error in paste function logic: {e}")
            # Return empty values on error
            vals = {field: None for field, _ in paste_fields}
        
        # Handle override settings
        if override_settings_component is not None:
            try:
                already_handled_fields = {key: 1 for _, key in paste_fields}
                override_vals = get_override_settings(params, skip_fields=already_handled_fields)
                vals_pairs = [f"{infotext_text}: {value}" for infotext_text, setting_name, value in override_vals]
                vals[override_settings_component] = gr.Dropdown.update(
                    value=vals_pairs, 
                    choices=vals_pairs, 
                    visible=bool(vals_pairs)
                )
            except Exception as e:
                logger.error(f"[ForgeCouple] Error handling override settings: {e}")
                vals[override_settings_component] = gr.Dropdown.update(value=[], choices=[], visible=False)
        
        # Return values in the order expected by gradio
        return [vals.get(field, None) for field, _ in paste_fields]


# Global instance
forge_couple_paste_hook = ForgeCoupleParameterPasteHook()


class ForgeCoupleParameterPasteScript(scripts.Script):
    """Script to initialize the parameter paste hook"""
    
    def title(self):
        return "Forge Couple Parameter Paste Hook"
    
    def show(self, is_img2img):
        return scripts.AlwaysVisible
    
    def ui(self, is_img2img):
        # Initialize the hook when the UI is created
        forge_couple_paste_hook.hook_paste_system()
        
        # Create a hidden component to handle JS execution
        mode = 'i2i' if is_img2img else 't2i'
        
        with gr.Group(visible=False):
            js_executor = gr.HTML(elem_id=f"forge_couple_js_executor_{mode}")
            
            # Set up periodic check for pending JS
            def check_pending_js():
                if hasattr(shared, 'forge_couple_pending_js') and mode in shared.forge_couple_pending_js:
                    js_code = shared.forge_couple_pending_js[mode]
                    del shared.forge_couple_pending_js[mode]
                    return f"<script>{js_code}</script>"
                return ""
            
            # Create a timer to check for pending JS
            timer = gr.Timer(value=0.5, active=True)
            timer.tick(
                fn=check_pending_js,
                outputs=[js_executor],
                show_progress=False
            )
        
        return []
    
    def process(self, p, *args):
        # This script doesn't modify the generation process
        pass


def on_ui_tabs():
    """Called when UI tabs are created - ensure our hook is active"""
    forge_couple_paste_hook.hook_paste_system()


# Register the callback
try:
    from modules import script_callbacks
    script_callbacks.on_ui_tabs(on_ui_tabs)
except ImportError:
    logger.warning("[ForgeCouple] Could not register UI tabs callback")
