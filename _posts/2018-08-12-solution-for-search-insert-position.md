---
layout: post
title: Solution for Search Insert Position
---

[Search Insert Position](https://leetcode.com/problems/search-insert-position/description/)

根据输入的数组`nums`和一个数字`target`，查找按照从小到大顺序下`target`在数组中的插入位置

- 遍历数组`nums`，如果当前元素`num`大于等于`target`，返回当前位置`index`
- 如果整个数组中不存在一个元素大于等于`target`，那么返回当前数组长度`len(nums)`
  
```python
class Solution(object):
    def searchInsert(self, nums, target):
        """
        :type nums: List[int]
        :type target: int
        :rtype: int
        """
        for index, num in enumerate(nums):
            if target <= num:
                return index

        return len(nums)
```