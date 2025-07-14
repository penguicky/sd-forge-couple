# ForgeCouple Shadow DOM Implementation

This document describes the Shadow DOM implementation for forge-couple's advanced mode compatibility with lobe-theme.

## Overview

The Shadow DOM implementation provides complete isolation of forge-couple's advanced mode interface from lobe-theme's React virtual DOM, preventing conflicts and ensuring reliable functionality.

## Architecture

### Core Components

1. **ForgeCoupleAdvancedShadowContainer** (`shadow-dom-container.js`)
   - Main Shadow DOM host component
   - Handles shadow root creation and style injection
   - Manages lifecycle and cleanup

2. **ShadowForgeCouple** (`shadow-forge-couple.js`)
   - Core functionality implementation within Shadow DOM
   - Canvas rendering and region management
   - Table interactions and data synchronization

3. **EventBridge** (`event-bridge.js`)
   - Communication bridge between React and vanilla JavaScript
   - Singleton event bus for cross-context messaging
   - Debug and monitoring capabilities

4. **BackendBridge** (`backend-bridge.js`)
   - Direct API communication without Gradio dependencies
   - WebSocket support for real-time updates
   - Retry logic and error handling

5. **ResourceManager** (`resource-manager.js`)
   - Memory management and cleanup
   - Event listener tracking
   - Timer and observer management

### React Integration

6. **ForgeCoupleIntegration** (`ForgeCoupleIntegration.tsx`)
   - React component for lobe-theme integration
   - Portal-based rendering
   - External API exposure

7. **ShadowDOMLoader** (`shadow-dom-loader.js`)
   - Dynamic script loading
   - Automatic initialization
   - Compatibility detection

## Features

### Complete Isolation
- Shadow DOM provides complete CSS and DOM isolation
- No conflicts with React virtual DOM updates
- Independent event handling and state management

### Interactive Canvas
- Drag and drop region creation
- Resize handles for precise adjustment
- Visual feedback and selection states
- Grid overlay for alignment

### Region Management
- Add, delete, and modify regions
- Color-coded visualization
- Coordinate validation and constraints
- Export/import configuration

### Backend Communication
- Direct API calls without Gradio dependencies
- WebSocket support for real-time updates
- Automatic retry and error handling
- Progress monitoring

### React Integration
- Seamless integration with lobe-theme
- External API for programmatic control
- Event-driven communication
- Automatic cleanup and resource management

## Installation

### 1. Script Loading

Add the shadow DOM loader to your forge-couple extension:

```html
<script src="/extensions/forge-couple/javascript/shadow-dom-loader.js"></script>
```

### 2. React Component Integration

In your lobe-theme setup, import and use the integration component:

```tsx
import { ForgeCoupleIntegration } from '@/components/ExtensionIntegration';

// In your component
<ForgeCoupleIntegration
  mode="t2i"
  visible={isAdvancedMode}
  onRegionsChange={handleRegionsChange}
  onGenerate={handleGenerate}
/>
```

### 3. Automatic Initialization

The system automatically detects lobe-theme and initializes Shadow DOM components when needed.

## Usage

### Basic Usage

1. Enable advanced mode in forge-couple
2. The Shadow DOM interface will automatically replace the original interface when lobe-theme is active
3. Use the canvas to create and modify regions
4. Configure prompts and weights in the table
5. Generate images with the configured regions

### Programmatic Control

```javascript
// Get API reference
const hostElement = document.querySelector('.forge-couple-shadow-host[data-mode="t2i"]');
const api = hostElement.forgeCoupleApi;

// Get current regions
const regions = api.getRegions();

// Set regions programmatically
api.setRegions([
  { x1: 0, y1: 0, x2: 0.5, y2: 1, weight: 1.0, prompt: 'left side' },
  { x1: 0.5, y1: 0, x2: 1, y2: 1, weight: 1.0, prompt: 'right side' }
]);

// Clear all regions
api.clearRegions();

// Reset to default
api.resetToDefault();
```

### Event Handling

```javascript
// Get event bridge
const eventBridge = EventBridge.getInstance();

// Listen for region changes
eventBridge.on('regions:changed', (event) => {
  console.log('Regions updated:', event.detail.regions);
});

// Listen for generation requests
eventBridge.on('forge-couple:generate', (event) => {
  console.log('Generate requested:', event.detail);
});

// Emit custom events
eventBridge.emit('custom:event', { data: 'example' });
```

## Configuration

### Debug Mode

Enable debug mode for detailed logging:

```javascript
const eventBridge = EventBridge.getInstance();
eventBridge.setDebugMode(true);
```

### Backend Configuration

Configure backend endpoints:

```javascript
const backendBridge = window.forgeCoupleBackendBridge;
backendBridge.apiEndpoint = '/custom/api/endpoint';
```

## Troubleshooting

### Common Issues

1. **Scripts not loading**
   - Check network requests in browser dev tools
   - Verify script paths are correct
   - Ensure server is serving static files

2. **Shadow DOM not initializing**
   - Check console for error messages
   - Verify lobe-theme is active
   - Ensure all required classes are loaded

3. **React integration not working**
   - Check React component imports
   - Verify TypeScript types are correct
   - Ensure proper cleanup in useEffect

4. **Backend communication failing**
   - Check API endpoints are available
   - Verify CORS settings
   - Check WebSocket connection

### Debug Information

Access debug information:

```javascript
// Event bridge statistics
const eventBridge = EventBridge.getInstance();
console.log(eventBridge.getStats());

// Resource manager statistics
const resourceManager = new ResourceManager();
console.log(resourceManager.getStats());

// Check initialization status
console.log(window.initializeForgeCoupleShawDOM);
```

## Performance Considerations

- Shadow DOM provides better performance than iframes
- Event delegation minimizes memory usage
- Resource manager prevents memory leaks
- Optimized canvas rendering with requestAnimationFrame

## Browser Compatibility

- Chrome 53+
- Firefox 63+
- Safari 10+
- Edge 79+

For older browsers, consider using webcomponents.js polyfill.

## Contributing

When contributing to the Shadow DOM implementation:

1. Follow the existing code structure
2. Add proper error handling
3. Include cleanup in destroy methods
4. Test with both lobe-theme enabled and disabled
5. Verify memory usage and performance

## License

This implementation follows the same license as the forge-couple extension.
