from json import dumps, loads
from json.decoder import JSONDecodeError

import gradio as gr
from PIL import Image, ImageDraw

from lib_couple.logging import logger

DEFAULT_MAPPING = [[0.0, 0.5, 0.0, 1.0, 1.0], [0.5, 1.0, 0.0, 1.0, 1.0]]
COLORS = ("red", "orange", "yellow", "green", "blue", "indigo", "violet")


def validate_mapping(data: list, log: bool = False) -> bool:
    for x1, x2, y1, y2, w in data:
        for v in (x1, x2, y1, y2, w):
            if not (isinstance(v, float) or isinstance(v, int)):
                if log:
                    logger.error('Mappings must be "float"...')
                return False

        if not all(0.0 <= v <= 1.0 for v in (x1, x2, y1, y2)):
            if log:
                logger.error("Region range must be between 0.0 and 1.0...")
            return False

        if x2 < x1 or y2 < y1:
            if log:
                logger.error('"to" value must be larger than "from" value...')
            return False

    return True


def visualize_mapping(mode: str, res: str, mapping: list) -> Image.Image:
    if mode != "Advanced":
        return gr.skip()

    p_width, p_height = [int(v) for v in res.split("x")]

    while p_width * p_height > 1024 * 1024:
        p_width, p_height = p_width // 2, p_height // 2

    while p_width * p_height < 512 * 512:
        p_width, p_height = p_width * 2, p_height * 2

    matt = Image.new("RGBA", (p_width, p_height), (0, 0, 0, 64))

    if not (validate_mapping(mapping)):
        return matt

    line_width = int(max(min(p_width, p_height) / 128, 4.0))

    draw = ImageDraw.Draw(matt)

    for tile_index, (x1, x2, y1, y2, w) in enumerate(mapping):
        x_from = int(p_width * x1)
        x_to = int(p_width * x2)
        y_from = int(p_height * y1)
        y_to = int(p_height * y2)

        color_index = tile_index % 7
        draw.rectangle(
            ((x_from, y_from), (x_to, y_to)),
            outline=COLORS[color_index],
            width=line_width,
        )

    return matt


def on_entry(data: str) -> list[list]:
    if not data.strip():
        return gr.skip()

    try:
        parsed_data = loads(data)

        # Check if this is a request for smart coordinate generation
        if isinstance(parsed_data, dict) and 'regions' in parsed_data:
            num_regions = parsed_data.get('regions', 2)
            if isinstance(num_regions, int) and num_regions > 0:
                logger.info(f"Generating smart coordinates for {num_regions} regions from paste data")
                return generate_smart_coordinates(num_regions)

        # Check if this is coordinate data
        if isinstance(parsed_data, list):
            # Validate the coordinate data
            if validate_mapping(parsed_data, log=True):
                return parsed_data
            else:
                # If invalid, generate smart coordinates based on the number of regions
                num_regions = len(parsed_data) if parsed_data else 2
                logger.info(f"Invalid coordinates received, generating smart coordinates for {num_regions} regions")
                return generate_smart_coordinates(num_regions)

        return parsed_data
    except JSONDecodeError:
        logger.error("Something went wrong while parsing advanced mapping...")
        return DEFAULT_MAPPING


def generate_smart_coordinates(num_regions: int) -> list[list]:
    """Generate smart coordinate mapping based on number of regions"""
    if num_regions <= 0:
        return DEFAULT_MAPPING

    if num_regions == 1:
        # Single region covers entire image
        return [[0.0, 1.0, 0.0, 1.0, 1.0]]

    if num_regions == 2:
        # Two regions: left and right halves
        return [
            [0.0, 0.5, 0.0, 1.0, 1.0],  # Left half
            [0.5, 1.0, 0.0, 1.0, 1.0]   # Right half
        ]

    if num_regions == 3:
        # Three regions: left, center, right
        return [
            [0.0, 0.33, 0.0, 1.0, 1.0],   # Left third
            [0.33, 0.67, 0.0, 1.0, 1.0],  # Center third
            [0.67, 1.0, 0.0, 1.0, 1.0]    # Right third
        ]

    if num_regions == 4:
        # Four regions: 2x2 grid
        return [
            [0.0, 0.5, 0.0, 0.5, 1.0],    # Top-left
            [0.5, 1.0, 0.0, 0.5, 1.0],    # Top-right
            [0.0, 0.5, 0.5, 1.0, 1.0],    # Bottom-left
            [0.5, 1.0, 0.5, 1.0, 1.0]     # Bottom-right
        ]

    if num_regions <= 6:
        # Up to 6 regions: 2x3 or 3x2 grid
        if num_regions == 5:
            # 5 regions: top row (3), bottom row (2)
            return [
                [0.0, 0.33, 0.0, 0.5, 1.0],   # Top-left
                [0.33, 0.67, 0.0, 0.5, 1.0],  # Top-center
                [0.67, 1.0, 0.0, 0.5, 1.0],   # Top-right
                [0.0, 0.5, 0.5, 1.0, 1.0],    # Bottom-left
                [0.5, 1.0, 0.5, 1.0, 1.0]     # Bottom-right
            ]
        else:  # 6 regions
            # 6 regions: 2x3 grid
            return [
                [0.0, 0.33, 0.0, 0.5, 1.0],   # Top-left
                [0.33, 0.67, 0.0, 0.5, 1.0],  # Top-center
                [0.67, 1.0, 0.0, 0.5, 1.0],   # Top-right
                [0.0, 0.33, 0.5, 1.0, 1.0],   # Bottom-left
                [0.33, 0.67, 0.5, 1.0, 1.0],  # Bottom-center
                [0.67, 1.0, 0.5, 1.0, 1.0]    # Bottom-right
            ]

    # For more than 6 regions, create a grid layout
    import math
    cols = math.ceil(math.sqrt(num_regions))
    rows = math.ceil(num_regions / cols)

    coordinates = []
    region_idx = 0

    for row in range(rows):
        for col in range(cols):
            if region_idx >= num_regions:
                break

            x1 = col / cols
            x2 = (col + 1) / cols
            y1 = row / rows
            y2 = (row + 1) / rows

            coordinates.append([x1, x2, y1, y2, 1.0])
            region_idx += 1

    return coordinates


def on_pull(data: dict) -> str:
    if not data:
        return ""

    try:
        # Check if this is coordinate data that needs smart coordinate generation
        if isinstance(data, dict) and 'regions' in data:
            num_regions = data.get('regions', 2)
            if isinstance(num_regions, int) and num_regions > 0:
                # Generate smart coordinates based on number of regions
                smart_coords = generate_smart_coordinates(num_regions)
                logger.info(f"Generated smart coordinates for {num_regions} regions")
                return dumps(smart_coords)

        # Check if data is a list (direct coordinate data)
        if isinstance(data, list):
            # If it's the default mapping, try to generate better coordinates
            if data == DEFAULT_MAPPING and len(data) > 0:
                # Keep the default for 2 regions, but could be enhanced
                pass
            return dumps(data)

        return dumps(data)
    except JSONDecodeError:
        logger.error("Something went wrong while parsing advanced mapping...")
        return ""
