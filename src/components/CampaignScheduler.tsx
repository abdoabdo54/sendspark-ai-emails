
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, Repeat } from 'lucide-react';

interface ScheduleOptions {
  enabled: boolean;
  scheduleType: 'immediate' | 'scheduled' | 'recurring';
  scheduledDate: string;
  scheduledTime: string;
  timezone: string;
  recurringPattern: 'daily' | 'weekly' | 'monthly';
  recurringInterval: number;
  endDate?: string;
}

interface CampaignSchedulerProps {
  onScheduleChange: (schedule: ScheduleOptions) => void;
  initialSchedule?: ScheduleOptions;
}

const CampaignScheduler = ({ onScheduleChange, initialSchedule }: CampaignSchedulerProps) => {
  const [schedule, setSchedule] = useState<ScheduleOptions>(initialSchedule || {
    enabled: false,
    scheduleType: 'immediate',
    scheduledDate: '',
    scheduledTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recurringPattern: 'weekly',
    recurringInterval: 1
  });

  const updateSchedule = (updates: Partial<ScheduleOptions>) => {
    const newSchedule = { ...schedule, ...updates };
    setSchedule(newSchedule);
    onScheduleChange(newSchedule);
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getMinTime = () => {
    const now = new Date();
    const selectedDate = new Date(schedule.scheduledDate);
    const today = new Date();
    
    if (selectedDate.toDateString() === today.toDateString()) {
      return now.toTimeString().slice(0, 5);
    }
    return '00:00';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Campaign Scheduling
            </CardTitle>
            <CardDescription>
              Schedule your campaign to send at a specific time or set up recurring sends
            </CardDescription>
          </div>
          <Switch
            checked={schedule.enabled}
            onCheckedChange={(enabled) => updateSchedule({ enabled })}
          />
        </div>
      </CardHeader>
      
      {schedule.enabled && (
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Schedule Type</Label>
              <Select 
                value={schedule.scheduleType} 
                onValueChange={(value: any) => updateSchedule({ scheduleType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Send Immediately</SelectItem>
                  <SelectItem value="scheduled">Schedule for Later</SelectItem>
                  <SelectItem value="recurring">Recurring Campaign</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {schedule.scheduleType === 'scheduled' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={schedule.scheduledDate}
                    min={getMinDate()}
                    onChange={(e) => updateSchedule({ scheduledDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={schedule.scheduledTime}
                    min={schedule.scheduledDate === getMinDate() ? getMinTime() : '00:00'}
                    onChange={(e) => updateSchedule({ scheduledTime: e.target.value })}
                  />
                </div>
              </div>
            )}

            {schedule.scheduleType === 'recurring' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={schedule.scheduledDate}
                      min={getMinDate()}
                      onChange={(e) => updateSchedule({ scheduledDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={schedule.scheduledTime}
                      onChange={(e) => updateSchedule({ scheduledTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Input
                      type="date"
                      value={schedule.endDate || ''}
                      min={schedule.scheduledDate || getMinDate()}
                      onChange={(e) => updateSchedule({ endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Repeat Pattern</Label>
                    <Select 
                      value={schedule.recurringPattern} 
                      onValueChange={(value: any) => updateSchedule({ recurringPattern: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Every</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={schedule.recurringInterval}
                        onChange={(e) => updateSchedule({ recurringInterval: parseInt(e.target.value) || 1 })}
                        className="w-20"
                      />
                      <span className="text-sm text-slate-600">
                        {schedule.recurringPattern === 'daily' && 'day(s)'}
                        {schedule.recurringPattern === 'weekly' && 'week(s)'}
                        {schedule.recurringPattern === 'monthly' && 'month(s)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select 
                value={schedule.timezone} 
                onValueChange={(value) => updateSchedule({ timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="Europe/London">Greenwich Mean Time (GMT)</SelectItem>
                  <SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Japan Standard Time (JST)</SelectItem>
                  <SelectItem value="Australia/Sydney">Australian Eastern Time (AET)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(schedule.scheduleType === 'scheduled' || schedule.scheduleType === 'recurring') && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Schedule Summary</span>
                </div>
                <div className="text-sm text-blue-700">
                  {schedule.scheduleType === 'scheduled' && schedule.scheduledDate && schedule.scheduledTime && (
                    <p>
                      Campaign will be sent on {new Date(schedule.scheduledDate).toLocaleDateString()} at {schedule.scheduledTime} ({schedule.timezone})
                    </p>
                  )}
                  {schedule.scheduleType === 'recurring' && schedule.scheduledDate && schedule.scheduledTime && (
                    <p>
                      Campaign will start on {new Date(schedule.scheduledDate).toLocaleDateString()} at {schedule.scheduledTime} and repeat every {schedule.recurringInterval} {schedule.recurringPattern}
                      {schedule.endDate && ` until ${new Date(schedule.endDate).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default CampaignScheduler;
