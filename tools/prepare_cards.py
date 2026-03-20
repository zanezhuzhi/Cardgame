"""
卡牌资源预处理脚本
从 策划文档/打印卡牌/ 复制并重命名到 tools/input/ 目录

运行方式：
cd D:\Cardgame\tools
python prepare_cards.py
"""

import shutil
from pathlib import Path

# 源目录
SOURCE_BASE = Path("../策划文档/打印卡牌")

# 目标目录
TARGET_BASE = Path("input")

# ============ 鬼王卡映射 (10张) ============
# 源文件: 各1张/鬼王01.png ~ 鬼王10.png
# 目标: input/boss/01.png ~ 10.png
BOSS_MAPPING = {
    "鬼王01.png": "01.png",  # 麒麟
    "鬼王02.png": "02.png",  # 石距
    "鬼王03.png": "03.png",  # 鬼灵歌伎
    "鬼王04.png": "04.png",  # 土蜘蛛
    "鬼王05.png": "05.png",  # 胧车
    "鬼王06.png": "06.png",  # 蜃气楼
    "鬼王07.png": "07.png",  # 荒骷髅
    "鬼王08.png": "08.png",  # 地震鲶
    "鬼王09.png": "09.png",  # 八岐大蛇
    "鬼王10.png": "10.png",  # 贪嗔痴
}

# ============ 式神卡映射 (24张) ============
# 源文件: 各1张/式神01.png ~ 式神24.png
# 目标: input/shikigami/01.png ~ 24.png
SHIKIGAMI_MAPPING = {
    "式神01.png": "01.png",  # 妖刀姬
    "式神02.png": "02.png",  # 大天狗
    "式神03.png": "03.png",  # 酒吞童子
    "式神04.png": "04.png",  # 茨木童子
    "式神05.png": "05.png",  # 花鸟卷
    "式神06.png": "06.png",  # 书翁
    "式神07.png": "07.png",  # 百目鬼
    "式神08.png": "08.png",  # 鬼使白
    "式神09.png": "09.png",  # 般若
    "式神10.png": "10.png",  # 追月神
    "式神11.png": "11.png",  # 白狼
    "式神12.png": "12.png",  # 食梦貘
    "式神13.png": "13.png",  # 鲤鱼精
    "式神14.png": "14.png",  # 萤草
    "式神15.png": "15.png",  # 独眼小僧
    "式神16.png": "16.png",  # 食发鬼
    "式神17.png": "17.png",  # 巫蛊师
    "式神18.png": "18.png",  # 山童
    "式神19.png": "19.png",  # 丑时之女
    "式神20.png": "20.png",  # 三尾狐
    "式神21.png": "21.png",  # 青蛙瓷器
    "式神22.png": "22.png",  # 铁鼠
    "式神23.png": "23.png",  # 座敷童子
    "式神24.png": "24.png",  # 山兔
}

# ============ 妖怪卡映射 (39张) ============
# 源文件: 各X张/游荡XX.png
# 目标: input/yokai/01.png ~ 39.png
# 注意：游荡编号需要按策划文档顺序重新排列
YOKAI_MAPPING = {
    # HP=1 (招福达摩需要单独处理，可能是令牌)
    # HP=2 (6种)
    "游荡1.png": "01.png",   # 招福达摩 (需确认)
    "游荡2.png": "02.png",   # 赤舌
    "游荡3.png": "03.png",   # 唐纸伞妖
    "游荡4.png": "04.png",   # 天邪鬼绿
    "游荡5.png": "05.png",   # 天邪鬼青
    "游荡6.png": "06.png",   # 天邪鬼赤
    "游荡7.png": "07.png",   # 天邪鬼黄
    # HP=3 (8种)
    "游荡8.png": "08.png",   # 魅妖
    "游荡9.png": "09.png",   # 灯笼鬼
    "游荡10.png": "10.png",  # 树妖
    "游荡11.png": "11.png",  # 日女巳时
    "游荡12.png": "12.png",  # 蚌精
    "游荡13.png": "13.png",  # 鸣屋
    "游荡14.png": "14.png",  # 蝠翼
    "游荡15.png": "15.png",  # 兵主部
    # HP=4 (8种)
    "游荡16.png": "16.png",  # 魍魉之匣
    "游荡17.png": "17.png",  # 骰子鬼
    "游荡18.png": "18.png",  # 涅槃之火
    "游荡19.png": "19.png",  # 雪幽魂
    "游荡20.png": "20.png",  # 轮入道
    "游荡21.png": "21.png",  # 网切
    "游荡22.png": "22.png",  # 铮
    "游荡23.png": "23.png",  # 薙魂
    # HP=5 (7种)
    "游荡24.png": "24.png",  # 狂骨
    "游荡25.png": "25.png",  # 返魂香
    "游荡26.png": "26.png",  # 镇墓兽
    "游荡27.png": "27.png",  # 针女
    "游荡28.png": "28.png",  # 心眼
    "游荡29.png": "29.png",  # 涂佛
    "游荡30.png": "30.png",  # 地藏像
    # HP=6 (4种)
    "游荡31.png": "31.png",  # 飞缘魔
    "游荡32.png": "32.png",  # 破势
    "游荡33.png": "33.png",  # 镜姬
    "游荡34.png": "34.png",  # 木魅
    # HP=7 (3种)
    "游荡35.png": "35.png",  # 幽谷响
    "游荡36.png": "36.png",  # 伤魂鸟
    "游荡37.png": "37.png",  # 阴摩罗
    # HP=8 (2种)
    "游荡38.png": "38.png",  # 青女房
    "游荡39.png": "39.png",  # 三味
}

# ============ 阴阳术卡映射 (3张) ============
# 源文件: 鬼火1-50张.png, 鬼火2-40张.png, 鬼火3-30张.png
# 目标: input/spell/01.png ~ 03.png
SPELL_MAPPING = {
    "鬼火1-50张.png": "01.png",  # 基础术式 (+1伤害, 50张)
    "鬼火2-40张.png": "02.png",  # 中级符咒 (+2伤害, 20张) - 数量不匹配，待确认
    "鬼火3-30张.png": "03.png",  # 高级符咒 (+3伤害, 10张) - 数量不匹配，待确认
}

# ============ 恶评卡映射 (2张) ============
# 源文件: 惩令01-30张.png, 惩令02-20张.png
# 目标: input/curse/01.png ~ 02.png
CURSE_MAPPING = {
    "惩令01-30张.png": "01.png",  # 农夫 (HP:1, 声誉-1, 20张) - 数量不匹配
    "惩令02-20张.png": "02.png",  # 武士 (HP:2, 声誉-2, 10张) - 数量不匹配
}

# 游荡卡源目录映射
YOKAI_SOURCE_DIRS = {
    "各1张": ["游荡1.png", "游荡3.png", "游荡7.png", "游荡8.png", "游荡16.png", 
              "游荡17.png", "游荡18.png", "游荡24.png", "游荡38.png", "游荡39.png"],
    "各2张": ["游荡1.png", "游荡3.png", "游荡7.png", "游荡8.png", "游荡16.png", 
              "游荡17.png", "游荡18.png", "游荡24.png", "游荡38.png", "游荡39.png"],
    "各3张": ["游荡2.png", "游荡4.png", "游荡9.png", "游荡10.png", "游荡19.png",
              "游荡20.png", "游荡25.png", "游荡26.png", "游荡31.png", "游荡35.png", "游荡36.png"],
    "各4张": ["游荡5.png", "游荡6.png", "游荡11.png", "游荡12.png", "游荡13.png",
              "游荡21.png", "游荡22.png", "游荡27.png", "游荡28.png", "游荡29.png",
              "游荡30.png", "游荡32.png", "游荡33.png", "游荡34.png", "游荡37.png"],
    "各5张": ["游荡14.png", "游荡15.png"],
    "各6张": ["游荡23.png"],
}

def ensure_dirs():
    """确保目标目录存在"""
    for subdir in ["boss", "yokai", "shikigami", "spell", "curse"]:
        (TARGET_BASE / subdir).mkdir(parents=True, exist_ok=True)
    print("✓ 目标目录已创建")

def copy_files(source_subdir: str, mapping: dict, target_subdir: str, desc: str):
    """复制并重命名文件"""
    print(f"\n处理 {desc}:")
    success = 0
    failed = []
    
    for src_name, dst_name in mapping.items():
        src_path = SOURCE_BASE / source_subdir / src_name
        dst_path = TARGET_BASE / target_subdir / dst_name
        
        if src_path.exists():
            shutil.copy2(src_path, dst_path)
            print(f"  ✓ {src_name} → {dst_name}")
            success += 1
        else:
            failed.append(src_name)
    
    if failed:
        print(f"  ✗ 未找到: {', '.join(failed)}")
    
    print(f"  完成: {success}/{len(mapping)}")
    return success, failed

def copy_yokai():
    """复制妖怪卡（需要从多个目录收集）"""
    print(f"\n处理 妖怪卡:")
    success = 0
    failed = []
    
    # 遍历所有源目录查找文件
    for src_name, dst_name in YOKAI_MAPPING.items():
        found = False
        for subdir in ["各1张", "各2张", "各3张", "各4张", "各5张", "各6张"]:
            src_path = SOURCE_BASE / subdir / src_name
            if src_path.exists():
                dst_path = TARGET_BASE / "yokai" / dst_name
                shutil.copy2(src_path, dst_path)
                print(f"  ✓ {subdir}/{src_name} → {dst_name}")
                success += 1
                found = True
                break
        
        if not found:
            failed.append(src_name)
    
    if failed:
        print(f"  ✗ 未找到: {', '.join(failed)}")
    
    print(f"  完成: {success}/{len(YOKAI_MAPPING)}")
    return success, failed

def copy_root_files():
    """复制根目录下的文件（阴阳术、恶评）"""
    print(f"\n处理 阴阳术卡:")
    success = 0
    for src_name, dst_name in SPELL_MAPPING.items():
        src_path = SOURCE_BASE / src_name
        dst_path = TARGET_BASE / "spell" / dst_name
        if src_path.exists():
            shutil.copy2(src_path, dst_path)
            print(f"  ✓ {src_name} → {dst_name}")
            success += 1
        else:
            print(f"  ✗ 未找到: {src_name}")
    print(f"  完成: {success}/{len(SPELL_MAPPING)}")
    
    print(f"\n处理 恶评卡:")
    success = 0
    for src_name, dst_name in CURSE_MAPPING.items():
        src_path = SOURCE_BASE / src_name
        dst_path = TARGET_BASE / "curse" / dst_name
        if src_path.exists():
            shutil.copy2(src_path, dst_path)
            print(f"  ✓ {src_name} → {dst_name}")
            success += 1
        else:
            print(f"  ✗ 未找到: {src_name}")
    print(f"  完成: {success}/{len(CURSE_MAPPING)}")

def main():
    print("=" * 50)
    print("🎴 卡牌资源预处理工具")
    print("=" * 50)
    print(f"源目录: {SOURCE_BASE.absolute()}")
    print(f"目标目录: {TARGET_BASE.absolute()}")
    
    ensure_dirs()
    
    # 复制鬼王卡
    copy_files("各1张", BOSS_MAPPING, "boss", "鬼王卡")
    
    # 复制式神卡
    copy_files("各1张", SHIKIGAMI_MAPPING, "shikigami", "式神卡")
    
    # 复制妖怪卡（从多个目录）
    copy_yokai()
    
    # 复制阴阳术和恶评卡
    copy_root_files()
    
    print("\n" + "=" * 50)
    print("✅ 预处理完成!")
    print("=" * 50)
    print("\n下一步: 运行 python process_images.py 处理图片尺寸")

if __name__ == "__main__":
    main()
