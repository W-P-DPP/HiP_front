/**
 * 公众号发表内容统计（GET /wx/summary/getSummary/statistics）响应类型。
 * 字段名与后端透传的微信数据逐字段对齐（snake_case），勿改为 camelCase。
 */

/** 阅读来源单行（read_user_source 元素）；含 scene_desc 为「全部」的总计行，绘图时需排除 */
export interface WxSceneSource {
  user_count: number
  scene_desc: string
}

/** 阅读位置单行（read_jump_position 元素）：读到第 position 段的读者占比 rate */
export interface WxReadJumpPosition {
  position: number
  rate: number
}

/** 单篇文章某一天的统计快照（detail_list 元素，微信 getarticletotaldetail 口径，每日值） */
export interface WxArticleDayStat {
  stat_date: string
  /** 阅读人数 */
  read_user: number
  /** 阅读来源分布 */
  read_user_source: WxSceneSource[]
  /** 分享人数 */
  share_user: number
  /** 关注来源阅读人数 */
  read_subscribe_user: number
  /** 阅读率 */
  read_delivery_rate: number
  /** 读完率 */
  read_finish_rate: number
  /** 平均阅读时长（秒） */
  read_avg_activetime: number
  /** 在看人数 */
  zaikan_user: number
  /** 点赞人数 */
  like_user: number
  /** 赞赏金额（分） */
  praise_money: number
  /** 评论数 */
  comment_count: number
  /** 收藏人数 */
  collection_user: number
  /** 阅读位置分布（部分日期返回） */
  read_jump_position?: WxReadJumpPosition[]
}

/** 一篇文章在查询区间内的聚合记录（list 元素，按 msgid 归并） */
export interface WxArticleStatItem {
  /** 发布日期 */
  ref_date: string
  /** 微信文章 msgid（字符串避免 64 位精度丢失） */
  msgid: string
  /** 发布类型 */
  publish_type: number
  detail_list: WxArticleDayStat[]
  title: string
  content_url: string
}

/** statistics 接口 data 载荷 */
export interface WxStatisticsResult {
  list: WxArticleStatItem[]
  /** 区间内远端抓取失败的日期（不阻断整体返回） */
  failedDays?: string[]
}

/** statistics 接口入参（前端以 YYYY-MM-DD 字符串传递） */
export interface WxStatRange {
  beginDate: string
  endDate: string
}

/** statistics 接口完整查询参数：日期区间 + 可选的目标用户（缺省时由会话决定） */
export interface WxStatisticsQuery extends WxStatRange {
  /** 目标用户 id（/users/children 任一层级）；省略时后端回退当前登录会话 */
  userId?: string
}
