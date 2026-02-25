import type { TaskType } from '../../types/schema'

const TASK_TUTORIALS: Record<TaskType, { title: string; bullets: string[] }> = {
  ai_sentence_audit: {
    title: 'AI句子识别审计教程',
    bullets: [
      '判断句子是否真实在讨论 AI（不是只包含模糊关键词）。',
      '填写 is_ai_true（0/1）；如为误报可补充 false_positive_type。',
      'notes 用于记录边界案例，便于后续仲裁与复盘。',
    ],
  },
  role_audit_qa_turns: {
    title: 'Q&A角色识别审计教程',
    bullets: [
      '先看当前 turn，再看前后上下文和完整 transcript（已高亮当前 turn）。',
      '标签只能选 analyst / management / operator / unknown。',
      '遇到主持人转接、多人插话，优先根据发言功能而非姓名判断。',
    ],
  },
  qa_boundary_audit_docs: {
    title: 'Q&A边界与配对质量教程',
    bullets: [
      '查看完整 earnings call script（默认展开），重点关注 speech 结尾与 Q&A 开头高亮位置。',
      'boundary_correct 判断 speech / qa 切分是否合理。',
      'pairing_quality 评估问答配对质量：good / minor_issue / major_issue / unusable。',
    ],
  },
  initiation_audit_exchanges: {
    title: 'AI initiation 审计教程',
    bullets: [
      '分别判断 question / answer 是否真实 AI 相关。',
      '再判断谁先引出 AI：analyst_initiated / management_pivot / analyst_only / non_ai。',
      'notes 记录歧义点，方便后续仲裁。',
    ],
  },
}

export function TaskTutorial({ taskType }: { taskType: TaskType }) {
  const tutorial = TASK_TUTORIALS[taskType]
  return (
    <details className="tutorial-box">
      <summary>教程</summary>
      <div className="tutorial-body">
        <strong>{tutorial.title}</strong>
        <ul>
          {tutorial.bullets.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </div>
    </details>
  )
}
