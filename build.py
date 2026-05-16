#!/usr/bin/env python3
# build.py - gas/style.html + gas/app.html → gas/index.html をビルド

with open('gas/style.html', 'r', encoding='utf-8') as f:
    style = f.read()

with open('gas/app.html', 'r', encoding='utf-8') as f:
    app = f.read()

with open('gas/template.html', 'r', encoding='utf-8') as f:
    template = f.read()

output = template.replace('{{STYLE}}', style).replace('{{APP}}', app)

with open('gas/index.html', 'w', encoding='utf-8') as f:
    f.write(output)

print(f"ビルド完了: gas/index.html ({len(output)}文字)")
