
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, TestTube } from 'lucide-react';

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'none' | 'tls' | 'ssl';
  auth_required: boolean;
}

interface SMTPConfigFormProps {
  config: SMTPConfig;
  onChange: (config: SMTPConfig) => void;
  onTest: () => void;
}

const SMTPConfigForm = ({ config, onChange, onTest }: SMTPConfigFormProps) => {
  const [showPassword, setShowPassword] = useState(false);

  const updateConfig = (field: keyof SMTPConfig, value: any) => {
    onChange({
      ...config,
      [field]: value
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SMTP Server Configuration</CardTitle>
        <CardDescription>
          Configure your SMTP server settings for email sending
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="smtp-host">SMTP Host</Label>
            <Input
              id="smtp-host"
              placeholder="smtp.gmail.com"
              value={config.host}
              onChange={(e) => updateConfig('host', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-port">Port</Label>
            <Input
              id="smtp-port"
              type="number"
              placeholder="587"
              value={config.port}
              onChange={(e) => updateConfig('port', parseInt(e.target.value) || 587)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-username">Username/Email</Label>
          <Input
            id="smtp-username"
            type="email"
            placeholder="your-email@gmail.com"
            value={config.username}
            onChange={(e) => updateConfig('username', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-password">Password/App Password</Label>
          <div className="relative">
            <Input
              id="smtp-password"
              type={showPassword ? "text" : "password"}
              placeholder="Your app password"
              value={config.password}
              onChange={(e) => updateConfig('password', e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="encryption">Encryption</Label>
          <Select value={config.encryption} onValueChange={(value: any) => updateConfig('encryption', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="tls">TLS (Recommended)</SelectItem>
              <SelectItem value="ssl">SSL</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="auth-required"
            checked={config.auth_required}
            onCheckedChange={(checked) => updateConfig('auth_required', checked)}
          />
          <Label htmlFor="auth-required">Authentication Required</Label>
        </div>

        <Separator />

        <Button onClick={onTest} variant="outline" className="w-full">
          <TestTube className="w-4 h-4 mr-2" />
          Test SMTP Connection
        </Button>
      </CardContent>
    </Card>
  );
};

export default SMTPConfigForm;
