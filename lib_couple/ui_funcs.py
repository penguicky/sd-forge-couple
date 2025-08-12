from json import dumps, loads
from json.decoder import JSONDecodeError

import gradio as gr
from PIL import Image, ImageDraw

from lib_couple.logging import logger

DEFAULT_MAPPING = [[0.0, 0.5, 0.0, 1.0, 1.0], [0.5, 1.0, 0.0, 1.0, 1.0]]
COLORS = ("red", "orange", "yellow", "green", "blue", "indigo", "violet")


def validate_mapping(data: list, log: bool = False) -> bool:
    """
    Simplified validation - comprehensive validation now happens in frontend unified sync
    This is a lightweight safety check for edge cases
    """
    if not data or not isinstance(data, list):
        if log:
            logger.error('Invalid mapping data format...')
        return False

    for region in data:
        if not isinstance(region, list) or len(region) != 5:
            if log:
                logger.error('Invalid region format - expected [x1, x2, y1, y2, weight]...')
            return False

        # Basic type check only - values are pre-validated by frontend
        for v in region:
            if not (isinstance(v, (float, int))):
                if log:
                    logger.error('Mappings must be numeric...')
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
    # Debug: Log paste field data reception
    logger.info(f"[ForgeCouple] on_entry received data: {data}")

    if not data.strip():
        logger.info("[ForgeCouple] on_entry: empty data, skipping")
        return gr.skip()

    try:
        parsed_data = loads(data)
        logger.info(f"[ForgeCouple] on_entry parsed data: {parsed_data}")
        return parsed_data
    except JSONDecodeError:
        logger.error("Something went wrong while parsing advanced mapping...")
        return DEFAULT_MAPPING


def on_pull(data: dict) -> str:
    if not data:
        return ""

    try:
        return dumps(data)
    except JSONDecodeError:
        logger.error("Something went wrong while parsing advanced mapping...")
        return ""
