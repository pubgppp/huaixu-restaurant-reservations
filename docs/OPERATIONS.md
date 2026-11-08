# 运行与部署

本项目是可运行的预约演示，使用单个 Node.js 进程和本地 JSON 文件保存预约。

## 环境变量

| 名称 | 默认值 | 用途 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址；容器内可设为 `0.0.0.0` |
| `DATA_FILE` | `data/reservations.json` | 持久化预约文件 |
| `BACKUP_DIR` | `data/backups` | `npm run backup` 的输出目录 |
| `STAFF_KEY` | 无 | 启用店员接口，至少 16 字符 |
| `RESTAURANT_TIME_ZONE` | `Australia/Sydney` | 餐厅营业日所属的 IANA 时区 |

## 部署要点

1. 准备 Node.js 20 或更新版本，并运行 `npm start`。
2. 将 `DATA_FILE` 放在持久化且仅服务账号可读写的目录，不要放进公开静态目录或 Git 仓库。
3. 如果对外开放，使用 HTTPS 反向代理，并把 `STAFF_KEY` 作为运行环境密钥设置；不要写进网页或提交记录。
4. 保持单个服务进程写同一个数据文件。当前文件存储不提供跨进程事务；多实例部署须先换成支持事务的数据库，否则可能超售。
5. 对外使用前完善隐私告知、真正的身份验证、通知渠道、备份恢复演练，以及代理环境下的分布式限流。

`GET /api/health` 用于检查服务和数据文件是否可读；成功时返回 `status: ok`。它不包含预约信息。

## 接口概览

| 接口 | 作用 |
| --- | --- |
| `GET /api/config` | 日期范围、时段和容量 |
| `GET /api/availability?date=YYYY-MM-DD` | 当日羊排和每时段座位余量 |
| `POST /api/reservations` | 创建预约 |
| `POST /api/reservations/lookup` | 用编号和电话查询 |
| `POST /api/reservations/cancel` | 用编号和电话取消 |
| `GET /api/staff/bookings?date=YYYY-MM-DD` | 店员查看当日预约 |
| `POST /api/staff/arrive` | 店员标记到店 |

店员接口要求请求头 `X-Staff-Key`。所有写入接口使用 JSON 请求体。客人查询、取消和创建有按来源 IP 的进程内频率限制。
