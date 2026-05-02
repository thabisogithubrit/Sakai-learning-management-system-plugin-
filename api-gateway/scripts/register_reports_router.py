from pathlib import Path

main_path = Path(__file__).resolve().parents[1] / "app" / "main.py"
text = main_path.read_text(encoding="utf-8")

if "from app.routers import reports" not in text:
    marker = "from app.routers import"
    lines = text.splitlines()
    inserted = False
    for idx, line in enumerate(lines):
        if line.startswith(marker):
            lines.insert(idx + 1, "from app.routers import reports")
            inserted = True
            break
    if not inserted:
        lines.insert(0, "from app.routers import reports")
    text = "\n".join(lines) + "\n"

if "app.include_router(reports.router)" not in text:
    lines = text.splitlines()
    insert_after = None
    for idx, line in enumerate(lines):
        if "app.include_router(" in line:
            insert_after = idx
    if insert_after is None:
        lines.append("app.include_router(reports.router)")
    else:
        lines.insert(insert_after + 1, "app.include_router(reports.router)")
    text = "\n".join(lines) + "\n"

main_path.write_text(text, encoding="utf-8")
print(f"Reports router registered in {main_path}")
