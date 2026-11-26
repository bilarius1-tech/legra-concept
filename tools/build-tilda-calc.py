#!/usr/bin/env python3
"""Собирает tilda/calc-t123.html — калькулятор одним куском для HTML-вставки Тильды (T123).
Запуск из корня репо:  python3 tools/build-tilda-calc.py [URL_папки_с_картинками]
По умолчанию картинки берутся с GitHub Pages макета."""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
base = (sys.argv[1] if len(sys.argv) > 1 else 'https://bilarius1-tech.github.io/legra-concept/img/calc/').rstrip('/') + '/'
css = (root / 'css/calc.css').read_text(encoding='utf-8')
cfg = (root / 'js/calc-config.js').read_text(encoding='utf-8')
js = (root / 'js/calc.js').read_text(encoding='utf-8')
cfg = re.sub(r"assetsBase: '[^']*'", "assetsBase: '%s'" % base, cfg)
out = f"""<!-- ЛЕГРА · калькулятор лестниц · вставка T123 (HTML). Собрано tools/build-tilda-calc.py. Не править вручную: меняйте css/calc.css, js/calc-config.js, js/calc.js и пересобирайте. -->
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet">
<style>
{css}
</style>
<a name="calc"></a>
<section class="lgc" id="calc"></section>
<script>
{cfg}
</script>
<script>
{js}
</script>
"""
(root / 'tilda').mkdir(exist_ok=True)
(root / 'tilda/calc-t123.html').write_text(out, encoding='utf-8')
print('tilda/calc-t123.html', len(out) // 1024, 'KB, images:', base)
