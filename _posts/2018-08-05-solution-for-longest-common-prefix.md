---
layout: post
title: Solution for Longest Common Prefix
---

[Longest Common Prefix](https://leetcode.com/problems/longest-common-prefix)

- 求一组字符串最长的相同前缀

思路如下：

1. 先找到这组字符串长度最短的一个
2. 遍历这个字符串，同时对比其他字符串相同位置的字符是否相等
3. 如果不相等，不再继续比较，直接返回当前字符串开头到当前位置的字串

```python
class Solution(object):
    def longestCommonPrefix(self, strs):
        """
        :type strs: List[str]
        :rtype: str
        """
        if not strs:
            return ""
        if len(strs) == 1:
            return strs[0]

        sortedStrs = sorted(strs,key=len)
        shortest = sortedStrs[0]

        if len(shortest) == 0:
            return ""

        for i, char in enumerate(shortest):
            for other in sortedStrs[1:]:
                if other[i] != char:
                    return shortest[:i]
        return shortest
```