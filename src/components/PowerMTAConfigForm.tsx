
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface PowerMTAConfig {
  server_host: string;
  api_port: number;
  username: string;
  password: string;
  virtual_mta: string;
  job_pool: string;
  max_hourly_rate: number;
}

interface PowerMTAConfigFormProps {
  config: PowerMTAConfig;
  onChange: (config: PowerMTAConfig) => void;
}

const PowerMTAConfigForm = ({ config, onChange }: PowerMTAConfigFormProps) => {
  const updateConfig = (field: keyof PowerMTAConfig, value: any) => {
    onChange({
      ...config,
      [field]: value
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>PowerMTA Configuration</CardTitle>
        <CardDescription>
          Configure your PowerMTA server for enterprise-level email delivery
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="powermta-host">Server Host</Label>
            <Input
              id="powermta-host"
              placeholder="smtp.yourdomain.com"
              value={config.server_host}
              onChange={(e) => updateConfig('server_host', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-port">API Port</Label>
            <Input
              id="api-port"
              type="number"
              placeholder="25"
              value={config.api_port}
              onChange={(e) => updateConfig('api_port', parseInt(e.target.value) || 25)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="powermta-username">Username</Label>
            <Input
              id="powermta-username"
              placeholder="admin"
              value={config.username}
              onChange={(e) => updateConfig('username', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="powermta-password">Password</Label>
            <Input
              id="powermta-password"
              type="password"
              placeholder="Your PowerMTA password"
              value={config.password}
              onChange={(e) => updateConfig('password', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="virtual-mta">Virtual MTA</Label>
          <Input
            id="virtual-mta"
            placeholder="default"
            value={config.virtual_mta}
            onChange={(e) => updateConfig('virtual_mta', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="job-pool">Job Pool</Label>
          <Select value={config.job_pool} onValueChange={(value) => updateConfig('job_pool', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select job pool" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="transactional">Transactional</SelectItem>
              <SelectItem value="bulk">Bulk</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-hourly-rate">Max Hourly Rate</Label>
          <Input
            id="max-hourly-rate"
            type="number"
            placeholder="10000"
            value={config.max_hourly_rate}
            onChange={(e) => updateConfig('max_hourly_rate', parseInt(e.target.value) || 10000)}
          />
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">PowerMTA Features:</h4>
          <div className="grid grid-cols-2 gap-2 text-sm text-green-800">
            <div>• High-volume delivery</div>
            <div>• Advanced bounce handling</div>
            <div>• IP warming support</div>
            <div>• Real-time monitoring</div>
            <div>• Domain-based routing</div>
            <div>• Feedback loop processing</div>
          </div>
        </div>

        <Badge variant="default" className="bg-green-600">
          Enterprise Solution: Up to millions of emails/day
        </Badge>
      </CardContent>
    </Card>
  );
};

export default PowerMTAConfigForm;
