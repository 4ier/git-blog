---
layout: post
title: Solution for Remove Duplicates from Sorted Array
---

题目要求不使用额外的空间进行去重，并且不要求指定长度后的数组元素结果

解决方案：把指针前面的子集可以作为新的数组使用即可

```python
class Solution(object):
    def removeDuplicates(self, nums):
        """
        :type nums: List[int]
        :rtype: int
        """
        if not nums:
            return 0
        if len(nums) < 2:
            return 1
        
        index = 0
        for i in range(1, len(nums)):
            if nums[i] != nums[index]:
                index = index + 1
                nums[index] = nums[i]

        return index + 1
```