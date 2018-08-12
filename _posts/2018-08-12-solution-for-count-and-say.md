---
layout: post
title: Solution for Count and Say
---

[Count and Say](https://leetcode.com/problems/count-and-say/description/)

题目定义的比较难懂，查看下列序列的规律：
```
 1.     1
 2.     11
 3.     21
 4.     1211
 5.     111221 
 6.     312211
 7.     13112221
 8.     1113213211
 9.     31131211131221
10.     13211311123113112211
```

<!-- more -->

上一个序列`n`中所有元素重复次数`count`拼上这个元素`ele`
   
例如
- `21`的下一个是：“1个2，1个1”，即：`1211`
- `1211`的下一个是：“1个1，1个2，2个1”，即：`111221`
- `111221`的下一个是："3个1，2个2，1个1"，即：`312211`

根据以上规律，可以得到一个转换函数`say()`，实现如下：

```python
def say(self, str2Say):
    lastChar = str2Say[0]
    returnStr = ""
    count = 1
    for char in str2Say[1:]:
        if lastChar == char:
            count += 1
        else:
            returnStr += str(count)
            returnStr += lastChar
            count = 1
        lastChar = char
    return returnStr + str(count) + lastChar
```

调用多次这个转换函数，即可返回题目要求的结果：

```python
def countAndSay(self, n):
    """
    :type n: int
    :rtype: str
    """
    str = "1"
    i = 0
    while i < n - 1: 
        str = self.say(str)
        i += 1
    
    return str
```