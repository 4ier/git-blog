---
layout: post
title: "闲置机二级备份"
date: 2025-12-23
categories: [运维]
tags: [Immich, Syncthing, Google Photos, Android, NAS, Caddy, systemd]
---

这篇记录一条**用闲置手机做二级备份**的完整方案：为家里 NAS 上部署的 Immich 建立一条 **Immich 原图 → 闲置手机 → Google Photos** 的备份通道。重点放在**整套方案的实现路径**（已脱敏），包括目录可识别、自动更新、硬链接节省空间等关键细节。

> 已对域名、IP、设备 ID、证书路径等敏感信息脱敏；路径与变量请按你环境替换。

<!-- more -->

## 1) 痛点与误区

- Immich 的 `upload` 目录是哈希分片结构，**目录名不可读**。
- Google Photos 的“备份设备文件夹”开关是**按“直接包含媒体文件的父目录”**分桶；
  `upload` 根目录里没有媒体文件，所以**看不到一个统一的可勾选目录**。
- Android 上 `Download` 目录常常不被识别，**`DCIM`/`Pictures` 更稳**。
- `upload` 目录大小可能远小于“Immich 总占用”，因为后者包含缩略图/转码/外部库。

## 2) 二级备份方案概览

1. NAS 上运行 Syncthing（Docker），通过 HTTPS 访问管理界面。
2. 生成一个“可读导出视图”（按日期目录），**用硬链接**避免复制大文件。
3. systemd 定时任务**每小时更新导出视图**。
4. Syncthing 分享导出视图（Send Only）到 **闲置手机**（Receive Only）。
5. Google Photos 只需要备份 **一个清晰目录**，完成二级备份闭环。

## 3) 导出视图（硬链接）

核心思路：把 `upload` 的文件按日期映射到新目录，例如：

```
/export/by-date/2025/12/23/xxx.jpg
```

**优点**：
- 同盘硬链接几乎不占额外空间。
- Google Photos 可以识别“按日期目录”。

**限制**：
- 需要在同一文件系统。
- 若删除原文件，硬链接仍占空间（需同步清理导出目录）。

示例脚本（按文件 mtime 归档，注意不是 EXIF）：

```bash
#!/bin/sh
SRC="/data/immich/library/upload"
DEST="/data/immich/export/by-date"

mkdir -p "$DEST/.stfolder"

find "$SRC" -type f ! -name ".*" | while IFS= read -r f; do
  mtime=$(stat -c %y "$f" 2>/dev/null) || continue
  date_part=${mtime%% *}
  yyyy=${date_part%%-*}
  rest=${date_part#*-}
  mm=${rest%%-*}
  dd=${date_part##*-}

  dest_dir="$DEST/$yyyy/$mm/$dd"
  dest_file="$dest_dir/$(basename "$f")"

  if [ ! -e "$dest_file" ]; then
    mkdir -p "$dest_dir"
    ln "$f" "$dest_file" 2>/dev/null || true
  fi
done
```

## 4) 定时任务（每小时更新）

用 systemd timer 更稳：

```ini
# /etc/systemd/system/immich-export-sync.service
[Unit]
Description=Immich export view sync (hardlinks)

[Service]
Type=oneshot
Nice=10
ExecStart=/bin/sh /data/immich/export/sync-export.sh
```

```ini
# /etc/systemd/system/immich-export-sync.timer
[Unit]
Description=Run Immich export sync hourly

[Timer]
OnCalendar=hourly
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

启用：

```bash
systemctl daemon-reload
systemctl enable --now immich-export-sync.timer
```

## 5) Syncthing 配置要点

**NAS 端**（发送）：
- Folder Path: `/immich-export`
- Folder Type: `Send Only`

**手机端**（接收）：
- Folder Path: `/storage/emulated/0/DCIM/ImmichOriginals`
- Folder Type: `Receive Only`
- Ignore Permissions: 开启

**重要提示**：
- 只读目录需要 `.stfolder` 标记，可在 NAS 上手动创建一次。
- Google Photos “释放设备空间”后，Syncthing 会看到本地删除，**不要点 Revert Local Changes**。

## 6) Google Photos 侧操作

- Photos → 设置 → 备份 → 备份设备文件夹
- 开启 `ImmichOriginals`

如果目录没出现：
- 确保目录内已有媒体文件
- 确认权限“照片和视频”已允许
- 必要时触发媒体扫描或重启

## 7) 最终效果

- NAS 自动生成“按日期”导出目录。
- 手机只备份一个清晰目录，Google Photos 识别正常。
- 不额外占 NAS 大量空间。

## 8) 可选优化

- 如果你只想一个“单层目录”，可以改成扁平导出（仍是硬链接）。
- 若需要“按 EXIF 拍摄时间”归档，可用 `exiftool` 生成日期目录。

---

这条流水线把“Immich 的工程目录”变成“Google Photos 友好目录”，
让备份这件事从一次性折腾变成持续可用。
