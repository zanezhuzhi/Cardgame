"""
卡牌图片批量处理脚本
功能：压缩、裁剪、重命名图片到指定尺寸

依赖：pip install Pillow

使用方法：
1. 将原始图片放入 input/ 目录
2. 运行 python process_images.py
3. 处理后的图片会输出到对应的 output/ 子目录
"""

from PIL import Image
import os
from pathlib import Path

# ============ 配置区 ============

# 输入目录（放置原始图片）
INPUT_DIR = Path("input")

# 输出基础目录
OUTPUT_BASE = Path("../client/src/assets/images/cards")

# ============ 万智牌标准比例 ============
# 实体卡牌尺寸: 63mm × 88mm
# 长宽比: 63:88 ≈ 5:7 ≈ 0.716
# 
# 排版规则:
# - 鬼王卡: 横向 (88×63 → 宽>高)
# - 其他卡: 竖向 (63×88 → 高>宽)
#
# 输出 @2x 高分辨率，UI用CSS缩放，放大不模糊

# 基准宽度（所有卡牌统一）
CARD_WIDTH_BASE = 140   # UI显示基准宽度
SCALE_FACTOR = 2        # 输出倍率（@2x）
CARD_WIDTH = CARD_WIDTH_BASE * SCALE_FACTOR  # 实际输出宽度: 280px

def mtg_portrait(width):
    """竖向卡牌: 宽×高 = 63:88 (高>宽)"""
    return (width, int(width * 88 / 63))

def mtg_landscape(width):
    """横向卡牌: 宽×高 = 88:63 (宽>高)"""
    return (int(width * 88 / 63), width)

# ============ 编号规则 ============
# 1XX: 鬼王卡 (101-110)
# 2XX-3XX: 妖怪卡 (201-239)
# 4XX-5XX: 式神卡 (401-424)
# 6XX: 阴阳术卡 (601-603)
# 7XX: 恶评卡 (701-702)

# 各类卡牌的目标尺寸和输出目录
CARD_CONFIGS = {
    "boss": {
        "size": mtg_landscape(CARD_WIDTH),   # 鬼王卡：横向 390×280 (@2x)
        "output": "boss",
        "id_start": 101,                     # 编号从101开始
        "count": 10,
        "orientation": "landscape",
    },
    "yokai": {
        "size": mtg_portrait(CARD_WIDTH),    # 妖怪卡：竖向 280×390 (@2x)
        "output": "yokai",
        "id_start": 201,                     # 编号从201开始
        "count": 39,
        "orientation": "portrait",
    },
    "shikigami": {
        "size": mtg_portrait(CARD_WIDTH),    # 式神卡：竖向 280×390 (@2x)
        "output": "shikigami",
        "id_start": 401,                     # 编号从401开始
        "count": 24,
        "orientation": "portrait",
    },
    "spell": {
        "size": mtg_portrait(CARD_WIDTH),    # 阴阳术：竖向 280×390 (@2x)
        "output": "spell",
        "id_start": 601,                     # 编号从601开始
        "count": 3,
        "orientation": "portrait",
    },
    "curse": {
        "size": mtg_portrait(CARD_WIDTH),    # 恶评卡：竖向 280×390 (@2x)
        "output": "curse",
        "id_start": 701,                     # 编号从701开始
        "count": 2,
        "orientation": "portrait",
    },
}

# 图片质量（1-100，越高质量越好，文件越大）
JPEG_QUALITY = 85
PNG_COMPRESS = 6  # PNG压缩级别（0-9）

# ============ 处理函数 ============

def ensure_dirs():
    """确保所有目录存在"""
    INPUT_DIR.mkdir(exist_ok=True)
    for config in CARD_CONFIGS.values():
        output_path = OUTPUT_BASE / config["output"]
        output_path.mkdir(parents=True, exist_ok=True)
    print(f"✓ 目录已创建")

def resize_and_crop(img: Image.Image, target_size: tuple) -> Image.Image:
    """
    智能裁剪：先缩放到合适大小，再居中裁剪到目标尺寸
    """
    target_w, target_h = target_size
    img_w, img_h = img.size
    
    # 计算缩放比例（保持宽高比，确保能覆盖目标尺寸）
    scale = max(target_w / img_w, target_h / img_h)
    new_w = int(img_w * scale)
    new_h = int(img_h * scale)
    
    # 缩放
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # 居中裁剪
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    right = left + target_w
    bottom = top + target_h
    
    return img.crop((left, top, right, bottom))

def process_single_image(input_path: Path, output_path: Path, target_size: tuple):
    """处理单张图片"""
    try:
        img = Image.open(input_path)
        
        # 转换为RGBA（支持透明通道）
        if img.mode != "RGBA":
            img = img.convert("RGBA")
        
        # 裁剪到目标尺寸
        img = resize_and_crop(img, target_size)
        
        # 保存为PNG
        img.save(output_path, "PNG", compress_level=PNG_COMPRESS)
        
        return True
    except Exception as e:
        print(f"  ✗ 处理失败: {input_path.name} - {e}")
        return False

def process_card_type(card_type: str):
    """处理一类卡牌"""
    config = CARD_CONFIGS[card_type]
    input_subdir = INPUT_DIR / card_type
    output_subdir = OUTPUT_BASE / config["output"]
    
    if not input_subdir.exists():
        print(f"\n⚠ 跳过 {card_type}: 输入目录不存在 ({input_subdir})")
        return
    
    # 获取所有图片文件
    image_files = sorted([
        f for f in input_subdir.iterdir()
        if f.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp", ".gif"]
    ])
    
    if not image_files:
        print(f"\n⚠ 跳过 {card_type}: 没有找到图片文件")
        return
    
    id_start = config["id_start"]
    print(f"\n处理 {card_type} ({len(image_files)} 张):")
    print(f"  目标尺寸: {config['size'][0]}×{config['size'][1]} (@{SCALE_FACTOR}x)")
    print(f"  编号范围: {id_start} - {id_start + len(image_files) - 1}")
    print(f"  输出目录: {output_subdir}")
    
    success = 0
    for i, input_file in enumerate(image_files):
        # 生成输出文件名：三位数字编号（从id_start开始）
        card_id = id_start + i
        output_name = f"{card_id}.png"
        output_path = output_subdir / output_name
        
        if process_single_image(input_file, output_path, config["size"]):
            print(f"  ✓ {input_file.name} → {output_name}")
            success += 1
    
    print(f"  完成: {success}/{len(image_files)}")

def generate_mapping():
    """生成文件名映射表"""
    mapping_file = Path("image_mapping.md")
    
    lines = ["# 图片文件名映射表\n\n"]
    lines.append("> 此文件由 process_images.py 自动生成\n\n")
    
    for card_type, config in CARD_CONFIGS.items():
        output_subdir = OUTPUT_BASE / config["output"]
        if not output_subdir.exists():
            continue
        
        files = sorted(output_subdir.glob("*.png"))
        if not files:
            continue
        
        lines.append(f"## {card_type.capitalize()}\n\n")
        lines.append("| 文件名 | 对应卡牌 |\n")
        lines.append("|--------|----------|\n")
        
        for f in files:
            lines.append(f"| `{f.name}` | TODO |\n")
        
        lines.append("\n")
    
    with open(mapping_file, "w", encoding="utf-8") as f:
        f.writelines(lines)
    
    print(f"\n✓ 映射表已生成: {mapping_file}")

def main():
    print("=" * 50)
    print("🎴 卡牌图片批量处理工具")
    print("=" * 50)
    
    ensure_dirs()
    
    print(f"\n请将图片放入以下目录：")
    for card_type in CARD_CONFIGS:
        print(f"  - {INPUT_DIR / card_type}/")
    
    # 处理各类卡牌
    for card_type in CARD_CONFIGS:
        process_card_type(card_type)
    
    # 生成映射表
    generate_mapping()
    
    print("\n" + "=" * 50)
    print("✅ 处理完成!")
    print("=" * 50)

if __name__ == "__main__":
    main()
