"""
match_cards.py
读取 角色卡牌匹配表.md，将角色卡牌按编号复制重命名到 assets/images 对应目录。
直接保留 .webp 格式，不做转换。

用法：
    cd D:\Cardgame\tools
    python match_cards.py
"""

import re
import shutil
from pathlib import Path

# ── 路径配置 ──────────────────────────────────────────────
BASE_DIR    = Path(__file__).parent.parent
SRC_DIR     = BASE_DIR / "策划文档" / "角色卡牌"
TABLE_FILE  = Path(__file__).parent / "角色卡牌匹配表.md"
DEST_ROOTS  = {
    "boss":    BASE_DIR / "client/src/assets/images/bosses",
    "yokai":   BASE_DIR / "client/src/assets/images/yokai",
    "shiki":   BASE_DIR / "client/src/assets/images/shikigami",
    "spell":   BASE_DIR / "client/src/assets/images/spells",
    "curse":   BASE_DIR / "client/src/assets/images/curses",
}

def id_to_category(card_id: int) -> str:
    if 101 <= card_id <= 110: return "boss"
    if 201 <= card_id <= 239: return "yokai"
    if 401 <= card_id <= 424: return "shiki"
    if 601 <= card_id <= 603: return "spell"
    if 701 <= card_id <= 702: return "curse"
    return "unknown"

# ── 解析匹配表 ─────────────────────────────────────────────
def parse_table(md_path: Path):
    """返回 [(src_filename, card_id, note), ...]，跳过编号为空或 ? 的行"""
    entries = []
    in_table = False
    row_re = re.compile(r'^\|\s*(card_\d+\.webp)\s*\|\s*([^|]*)\s*\|\s*(\d+)\s*\|')

    for line in md_path.read_text(encoding="utf-8").splitlines():
        if "| 源文件 |" in line:
            in_table = True
            continue
        if in_table:
            m = row_re.match(line)
            if m:
                src_file = m.group(1).strip()
                note     = m.group(2).strip()
                card_id  = int(m.group(3).strip())
                entries.append((src_file, card_id, note))
    return entries

# ── 主流程 ─────────────────────────────────────────────────
def main():
    entries = parse_table(TABLE_FILE)
    if not entries:
        print("⚠️  匹配表中没有找到有效条目，请先填写输出编号。")
        return

    # 建目录
    for d in DEST_ROOTS.values():
        d.mkdir(parents=True, exist_ok=True)

    ok = skip = err = 0
    for src_file, card_id, note in entries:
        src_path = SRC_DIR / src_file
        category = id_to_category(card_id)

        if category == "unknown":
            print(f"  ⚠️  未知编号 {card_id}，跳过 {src_file}")
            skip += 1
            continue

        if not src_path.exists():
            print(f"  ❌ 源文件不存在: {src_path}")
            err += 1
            continue

        dest_path = DEST_ROOTS[category] / f"{card_id}.webp"
        shutil.copy2(src_path, dest_path)
        print(f"  ✅ {src_file}  →  {dest_path.relative_to(BASE_DIR)}")
        ok += 1

    print(f"\n完成！成功 {ok} 张，跳过 {skip} 张，失败 {err} 张。")

if __name__ == "__main__":
    main()
