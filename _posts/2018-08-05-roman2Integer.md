---
layout: post
title: roman2Integer
---
# Solution for <Roman to Integer>
[问题链接](https://leetcode.com/problems/roman-to-integer/description/)

## 倒序遍历求值
罗马数字存在以下特征：

| key | value |
| --- | ----- |
| I   | 1     |
| IV  | 4     |
| V   | 5     |
| IX  | 9     |
| X   | 10    |
| XL  | 40    |
| L   | 50    |
| XC  | 90    |
| C   | 100   |
| CD  | 400   |
| D   | 500   |
| CM  | 900   |
| M   | 1000  |

因此可以通过倒序遍历，判断当前字母和前一个字母的大小，求和时对应加上/减去该字母代表的数值，最终累加得到结果
```python
class Solution(object):
    def romanToInt(self, s):
        """
        :type s: str
        :rtype: int
        """
        numMap = {'I':1, 'V':5, 'X':10, 'L':50, 'C':100, 'D':500, 'M':1000}

        total = 0
        prev = 0
        for char in s[::-1]:
            curr = numMap[char]
            if curr < prev:
                total -= curr
            else:
                total += curr
            prev = curr
        return total
```