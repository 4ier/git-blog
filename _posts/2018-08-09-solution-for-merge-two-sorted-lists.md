---
layout: post
title: Solution for Merge Two Sorted Lists
---

[Merge Two Sorted Lists](https://leetcode.com/problems/merge-two-sorted-lists/description/)

问题是两个单向有序链表`A` / `B`合并，解题思路有两个

- 递归
  
比较`A`和`B`的第一个元素`a1` / `b1`，假设`a1` < `b1`，那么`A.next`和`B`先合并，合并后的第一个链表节点赋值给`A.next`，反之亦然，直到两个链表其中一个完成遍历，将剩余的节点挂在最后一个合并节点上即可完成合并

```python
# Definition for singly-linked list.
# class ListNode(object):
#     def __init__(self, x):
#         self.val = x
#         self.next = None

class Solution(object):
    def mergeTwoLists(self, l1, l2):
        """
        :type l1: ListNode
        :type l2: ListNode
        :rtype: ListNode
        """
        if not l1:
            return l2
        if not l2:
            return l1
        if l1.val < l2.val:
            l1.next = self.mergeTwoLists(l1.next, l2)
            return l1
        else:
            l2.next = self.mergeTwoLists(l1, l2.next)
            return l2
```

- 循环

同时遍历两个链表`A` /`B`，获取较小的元素，依次插入到一个新链表中，直到`A` /`B`其中一个遍历结束，将另一个的剩余节点挂在新链表末尾即可完成合并

```python
# Definition for singly-linked list.
# class ListNode(object):
#     def __init__(self, x):
#         self.val = x
#         self.next = None

class Solution(object):
    def mergeTwoLists(self, l1, l2):
        if not l1:
            return l2
        if not l2:
            return l1
        
        head = tmp = ListNode(0)

        while l1 and l2:
            if l1.val < l2.val:
                tmp.next = l1
                l1 = l1.next
            else:
                tmp.next = l2
                l2 = l2.next
            tmp = tmp.next
        if l1 or l2:
            tmp.next = l1 or l2
        return head.next
```
