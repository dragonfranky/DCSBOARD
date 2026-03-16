import re

with open('public/DRAWING/DR0003/DR0003.svg', 'r', encoding='utf-8') as f:
    content = f.read()

# Escape for JavaScript string
escaped = content.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')

print('rawSvg.value = "' + escaped + '";')