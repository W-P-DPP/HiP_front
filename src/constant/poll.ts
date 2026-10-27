/** 列表轮询间隔（毫秒）：进入页面后按此间隔刷新列表，离开页面由 react-query 自动清除定时器 */
export const LIST_POLL_INTERVAL = 10_000

/** 合成任务排队位置轮询间隔（毫秒）：任务出队执行后停止 */
export const SYNTHESIS_QUEUE_POLL_INTERVAL = 5_000

/** 合成任务状态轮询间隔（毫秒）：任务进入终态后停止 */
export const SYNTHESIS_TASK_POLL_INTERVAL = 10_000
