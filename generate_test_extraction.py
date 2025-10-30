from main import create_analysis_pdf

# Simulate analysis_data missing correctedCode but raw response contains a fenced code block
analysis = {
    'explanation': '',
    'bugs': [],
    'suggestions': [],
    # no correctedCode here
}

raw_response = '''Here is my analysis.

```python
# corrected version
def add(a, b):
    return a + b

print(add(1, 2))
```

End of response.'''

# code passed originally
code = 'def add(a,b):\n return a+b\n\nprint(add(1,2))\n'

# Call create_analysis_pdf with analysis_data that contains rawResponse
analysis['rawResponse'] = raw_response

pdf_buf = create_analysis_pdf(analysis_data=analysis, code=code, language='python')
with open('test_extraction.pdf', 'wb') as f:
    f.write(pdf_buf.getvalue())
print('test_extraction.pdf created')
