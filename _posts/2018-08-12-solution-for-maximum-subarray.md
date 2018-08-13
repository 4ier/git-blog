---
layout: post
title: Solution for Maximum Subarray
---

[Maximum Subarray](https://leetcode.com/problems/maximum-subarray/description/)

题目描述很简单：给定一个数组`nums`，在所有子数组的和中求最大值

- 暴力求解

从题目描述来看，可以使用穷举的方式求助所有子数组的和，比较最大值返回即可，代码实现如下：

<!-- more -->

```python
def maxSubArray(self, nums):  #复杂度为`o(n^2)`
    """
    :type nums: List[int]
    :rtype: int
    """
    summ = nums[0]

    for bIndex in range(len(nums)):
        for eIndex in range(1, len(nums[bIndex:]) + 1):
            tmp = sum(nums[bIndex:bIndex + eIndex])
            if tmp > summ:
                summ = tmp
    return summ
```

<!--more-->

但是这种解法效率过低，当遇到长度超过1w个元素的数组时，提交超时

- DP动态规划

将问题拆分为下面子问题：

假设当前子数组为`nums[i:j]`，如果`nums[j+1] > sum(nums[i:j+1])`，那么令`i = j, j = j + 1`，继续向后遍历

同时记录最大的`maxSum`，完成遍历后即为最终返回结果

```python
def maxSubArray(self, nums):
    """
    :type nums: List[int]
    :rtype: int
    """
    curIndex = 0
    curSum = maxSum = nums[0]
    for index,num in enumerate(nums[1:]):
        if num > curSum + num:
            curIndex = index + 1
        curSum = sum(nums[curIndex: index + 2])
        maxSum = max(maxSum, curSum)
    return maxSum
```

以上代码在遍历过程中，需要不断的通过`sum`求值，会带来性能上的问题（实测1000+ms），因此可以优化如下：

```python
    def maxSubArray(self, nums):
        """
        :type nums: List[int]
        :rtype: int
        """

        curSum = maxSum = nums[0]
        for num in nums[1:]:
            curSum = max(num, curSum + num)
            maxSum = max(maxSum, curSum)
        return maxSum
```

使用`max(num, curSum + num)`求当前最大值（实测30+ms）

- 分治法

在讨论组中看到的java分治代码，没看懂，备忘如下：

```java
class Solution {
    public int maxSubArray(int[] nums) {
        if (nums==null||nums.length==0) return 0;
        return helper(nums,0,nums.length-1);
    }
    public int helper(int[] nums,int low,int high)
    {
        if(low>high) return Integer.MIN_VALUE;
        if(low==high) return nums[low];
        int mid=(low+high)/2;
        int midsum,leftsum,rightsum;
        int i=mid;
        int j=mid;
        int maxmidleftsum=Integer.MIN_VALUE,maxmidrightsum=Integer.MIN_VALUE;
        int midleftsum=0,midrightsum=0;
        while(i>=low)
        {
            midleftsum=midleftsum+nums[i];
            maxmidleftsum=Math.max(maxmidleftsum,midleftsum);
            i=i-1;
        }
        while(j<=high)
        {
            midrightsum=midrightsum+nums[j];
            maxmidrightsum=Math.max(maxmidrightsum,midrightsum);
            j=j+1;
        }
        midsum=maxmidleftsum+maxmidrightsum-nums[mid];
        leftsum=helper(nums,low,mid-1);
        rightsum=helper(nums,mid+1,high);
        if(midsum>=leftsum&&midsum>=rightsum) return midsum;
        else if(leftsum>=midsum&&leftsum>=rightsum) return leftsum;
        else return rightsum;
    }
}
```
