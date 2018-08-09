---
layout: post
title: Solution for Remove Element
---

[Remove Element](https://leetcode.com/problems/remove-element/description/)

给出的数组`nums`和数值`val`，在满足`o(1)`空间复杂度的前提下，计算出删除`val`后剩余数组的长度`len`，要求处理后的数组前`len`个元素不包含`val`

题目比较简单，但是有些隐藏的陷阱：

- 遍历数组的同时删除元素，不能采用`for`循环进行，否则如果出现两个以上相等的元素，遍历时会跳过删除后前移的元素，如

```python
for i,n in enumerate(nums):
    if n == val:
        del nums[i] #删除元素后，数组后面列表元素自动前移，如果删除前nums[i+1] == val，那么删除后这个val自动移动到了nums[i]的位置，但是循环已经认为这个位置的元素处理过了不会再重复处理
return len(nums)
```

- 解决方案1：使用`while`循环和下标，控制遍历过程：
  
```python
i = 0
while(i < len(nums)):
    if nums[i] == val:
        del nums[i]
    else:
        i = i + 1
return len(nums)
```

在遍历时使用下标`i`控制遍历过程，如果匹配到了要删除的元素，下标`i`的值不自增，可以解决上面描述的遍历问题

- 解决方案2：使用数组的`remove()`方法

```python
for i in range(nums.count(val)):
    nums.remove(val)
return len(nums)
```

