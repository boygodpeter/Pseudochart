import numpy as np
from functools import update_wrapper

def fib(n):
    if n > 1:
        return fib(n-1) + fib(n-2)
    return n
for i in range(20):
    print(fib(i), end = ',')


a=1
b=2
if a==1:
    if a==2:
        print(1)
    elif a==3:
        print(2)
    elif a==5:
        print(5)
    else:
        print(3)

print(4)

a=1
b=2
for i in range(5):
    for j in range(5):
        print(4)
    # break