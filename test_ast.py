#!/usr/bin/env python3
import sys
import os

# Add the src/python directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src', 'python'))

# Test if graphviz is installed
try:
    import graphviz
    print("✓ Graphviz Python package is installed")
except ImportError:
    print("✗ Graphviz Python package is NOT installed")
    print("Please run: pip install graphviz")
    sys.exit(1)

# Test the ast_to_graphviz script
test_code = """
import random
answer = random.sample(range(1, 10), 4)
print(answer)
a = b = n = 0
while a!=4:
    a = b = n = 0
    user = list(input('enter:'))
    for i in user:
        if int(user[n]) == answer[n]:
            a += 1
        else:
            if int(i) in answer:
                b += 1
        n += 1
    output = '.'.join(user).replace('.', '')
    print(f'{output}: {a}A{b}B')
print('correct!')
"""

# Run the script
from ast_to_graphviz import main
import io

# Redirect stdin
old_stdin = sys.stdin
sys.stdin = io.StringIO(test_code)

try:
    main()
    print("\n✓ Script executed successfully")
except Exception as e:
    print(f"\n✗ Script failed with error: {e}")
    import traceback
    traceback.print_exc()
finally:
    sys.stdin = old_stdin