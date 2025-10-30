from main import create_analysis_pdf

analysis = {
    'explanation': 'Sample explanation with multiple lines.\nThis should wrap properly in the PDF and be visible.',
    'bugs': [
        {'description': 'Off-by-one in loop', 'line': 12, 'severity': 'medium'},
        {'description': 'Missing null check', 'line': 27, 'severity': 'high'}
    ],
    'suggestions': ['Use proper bounds', 'Add tests'],
    'correctedCode': 'for i in range(0, n):\n    print(i)\n'
}

code = '''def foo():
    for i in range(3):
        print(i)

print("done")
'''

pdf_buf = create_analysis_pdf(analysis_data=analysis, code=code, language='python')
with open('test_code_analysis.pdf', 'wb') as f:
    f.write(pdf_buf.getvalue())
print('PDF_CREATED')
