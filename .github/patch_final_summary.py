from pathlib import Path
p=Path('src/components/PumpModules.jsx')
patch=Path('.github/final-summary-section.txt').read_text(encoding='utf-8')
s=p.read_text(encoding='utf-8')
start=s.index('        <h3>Final Daily Summary</h3>')
end=s.index('      </section>',start)+len('      </section>')
p.write_text(s[:start]+patch+s[end:],encoding='utf-8')
print('Final Daily Summary patched')
