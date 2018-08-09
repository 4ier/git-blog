---
layout: post
title: Implement strStr()
---

[Implement strStr()](https://leetcode.com/problems/implement-strstr/description/)

给定两个字符串`strA` / `strB`，计算后者在前者第一次出现的首字母位置（`java`的`indexOf()`和`C`的`strStr()`）

```python
class Solution(object):
    def strStr(self, haystack, needle):
        """
        :type haystack: str
        :type needle: str
        :rtype: int
        """
        if not needle:
            return 0
        if haystack == needle:
            return 0

        for i in range(len(haystack)):
            subStr = ''.join(haystack[i : i + len(needle)])
            if len(needle) > len(subStr): #在输入的两个字符很长的情况下，有可能存在资源消耗过大，因此先用长度做简单判断
                return -1

            if subStr == needle:
                return i
        return  -1
```