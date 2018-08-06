---
layout: post
title: Solution for Valid Parentheses
---

[Valid Parentheses](https://leetcode.com/problems/valid-parentheses/description/)

- 使用栈匹配括号

通过栈这种数据结构可以很好的解决符号匹配问题：

1. 判定栈顶元素是否和当前元素匹配，例如`'('`和`')'`匹配
2. 如果匹配那么`pop`，如果不匹配那么`append`
3. 最后查看栈的长度是否为0

当输入字符串的长度无法被`2`整除时，可以判定一定不是正确的字符串

```python
class Solution(object):
    def isValid(self, s):
        """
        :type s: str
        :rtype: bool
        """
        matchPairs = {
            '(':')',
            '[':']',
            '{':'}',
            ')':'(',
            ']':'[',
            '}':'{'}

        stack = []
        if len(s) % 2 != 0:
            return False
        
        for char in s:
            if stack and matchPairs[stack[-1]] == char:
                stack.pop()
            else:
                stack.append(char)
        
        return 0 == len(stack)
```