
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Cloud, Code, Settings, Zap } from 'lucide-react';

const GoogleCloudSetupGuide = () => {
  const steps = [
    {
      title: "Create Google Cloud Project",
      description: "Sign up for Google Cloud Platform and create a new project",
      details: [
        "Go to console.cloud.google.com",
        "Create a new project or select existing one",
        "Enable billing (free tier available)",
        "Note your Project ID"
      ]
    },
    {
      title: "Enable Cloud Functions API",
      description: "Enable the necessary APIs for Cloud Functions",
      details: [
        "Go to APIs & Services > Library",
        "Search for 'Cloud Functions API'",
        "Click Enable",
        "Also enable 'Cloud Build API'"
      ]
    },
    {
      title: "Deploy Email Sending Function",
      description: "Deploy the provided Cloud Function code",
      details: [
        "Go to Cloud Functions in the console",
        "Click 'Create Function'",
        "Choose HTTP trigger",
        "Set runtime to Node.js 18+",
        "Copy the provided function code",
        "Set environment variables for SMTP settings"
      ]
    },
    {
      title: "Configure Authentication",
      description: "Set up secure access to your function",
      details: [
        "Go to IAM & Admin > Service Accounts",
        "Create a new service account",
        "Download the JSON key file",
        "Store the key securely"
      ]
    },
    {
      title: "Get Function URL",
      description: "Copy the trigger URL for your function",
      details: [
        "In Cloud Functions, click your function",
        "Go to the Trigger tab",
        "Copy the Trigger URL",
        "Paste this URL in the settings below"
      ]
    }
  ];

  const sampleCode = `const functions = require('@google-cloud/functions-framework');
const nodemailer = require('nodemailer');

functions.http('sendBulkEmails', async (req, res) => {
  const { emails, rateLimit } = req.body;
  
  const transporter = nodemailer.createTransporter({
    service: 'gmail', // or your SMTP service
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  // Send emails with rate limiting
  for (const email of emails) {
    await transporter.sendMail(email);
    await new Promise(resolve => setTimeout(resolve, 3600000 / rateLimit));
  }
  
  res.json({ success: true, sent: emails.length });
});`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Google Cloud Functions Setup Guide
          </CardTitle>
          <p className="text-sm text-slate-600">
            Follow these steps to set up high-speed email sending with Google Cloud Functions
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {steps.map((step, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                      {index + 1}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                    <p className="text-slate-600 mb-3">{step.description}</p>
                    <ul className="space-y-1">
                      {step.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Sample Cloud Function Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
            <code>{sampleCode}</code>
          </pre>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800">Environment Variables</h4>
                <p className="text-sm text-blue-600 mt-1">
                  Set these in your Cloud Function configuration:
                  <br />• SMTP_USER: Your email username
                  <br />• SMTP_PASS: Your email password or app password
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Benefits of Google Cloud Functions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Performance</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Send up to 3,600 emails/hour</li>
                <li>• Parallel processing</li>
                <li>• Auto-scaling infrastructure</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Reliability</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• 99.9% uptime SLA</li>
                <li>• Built-in error handling</li>
                <li>• Monitoring and logging</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleCloudSetupGuide;
