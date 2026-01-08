import { Clock, Mic, Zap } from 'lucide-react'

import { Card } from '@/components/ui/card'

interface DashboardStatsProps {
  hasFeedback?: boolean
  pulsesRemaining?: number
  totalFeedback?: number
  avgDuration?: number // in seconds
  thisWeekCount?: number
}

export function DashboardStats({
  hasFeedback = true,
  pulsesRemaining = 0,
  totalFeedback = 0,
  avgDuration = 0,
  thisWeekCount = 0,
}: DashboardStatsProps) {
  if (!hasFeedback) {
    const emptyStats = [
      {
        icon: Mic,
        label: 'Total Feedback',
        value: '0',
        change: 'Get started by sharing your QR code',
      },
      {
        icon: Zap,
        label: 'Pulses Remaining',
        value: pulsesRemaining.toString(),
        change:
          pulsesRemaining > 0
            ? 'Ready to collect feedback'
            : 'Buy pulses to get started',
      },
      {
        icon: Clock,
        label: 'Avg. Duration',
        value: '--',
        change: 'No data yet',
      },
    ]

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {emptyStats.map((stat, i) => (
          <Card
            key={i}
            className="p-6 border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-card"
          >
            <div className="flex items-start justify-between mb-4">
              <stat.icon
                className="w-8 h-8 text-muted-foreground"
                strokeWidth={2.5}
              />
            </div>
            <div className="text-4xl font-black mb-2 text-muted-foreground">
              {stat.value}
            </div>
            <div className="font-bold text-sm mb-1">{stat.label}</div>
            <div className="text-sm font-medium text-muted-foreground">
              {stat.change}
            </div>
          </Card>
        ))}
      </div>
    )
  }

  // Format average duration (seconds to MM:SS)
  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  // Format week change text
  const weekChangeText =
    thisWeekCount > 0
      ? `+${thisWeekCount} this week`
      : thisWeekCount === 0 && totalFeedback > 0
        ? 'No new feedback this week'
        : 'Get started by sharing your QR code'

  const stats = [
    {
      icon: Mic,
      label: 'Total Feedback',
      value: totalFeedback.toString(),
      change: weekChangeText,
    },
    {
      icon: Zap,
      label: 'Pulses Remaining',
      value: pulsesRemaining.toString(),
      change:
        pulsesRemaining > 50 ? 'Plenty available' : 'Consider topping up',
    },
    {
      icon: Clock,
      label: 'Avg. Duration',
      value: formatDuration(avgDuration),
      change:
        avgDuration > 0
          ? avgDuration >= 90
            ? 'Perfect length'
            : avgDuration >= 60
              ? 'Good length'
              : 'Short feedback'
          : 'No data yet',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.map((stat, i) => (
        <Card
          key={i}
          className="p-6 border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-card"
        >
          <div className="flex items-start justify-between mb-4">
            <stat.icon className="w-8 h-8 text-primary" strokeWidth={2.5} />
          </div>
          <div className="text-4xl font-black mb-2">{stat.value}</div>
          <div className="font-bold text-sm mb-1">{stat.label}</div>
          <div className="text-sm font-medium text-muted-foreground">
            {stat.change}
          </div>
        </Card>
      ))}
    </div>
  )
}

