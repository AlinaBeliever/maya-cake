#!/bin/bash
# Збирає чисту копію сайту для Netlify — без скрінів (materials), інструментів і технічних сторінок.
# Двічі клацніть цей файл: поруч з'явиться папка «maya-cake-deploy». Її й перетягуйте в Netlify.
cd "$(dirname "$0")"
OUT="../maya-cake-deploy"
rm -rf "$OUT"
mkdir -p "$OUT"
cp ./*.html "$OUT"/
rm -f "$OUT/styleguide.html"
cp -R css js data assets "$OUT"/
echo ""
echo "Готово! Папка для Netlify: $(cd "$OUT" && pwd)"
echo "Розмір: $(du -sh "$OUT" | cut -f1)"
open "$OUT/.."
