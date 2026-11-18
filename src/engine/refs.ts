// Standard names used in rule references, in one place so the wording never drifts.

export const API_TOP10 = {
  API1: 'API1:2023 Broken Object Level Authorization',
  API2: 'API2:2023 Broken Authentication',
  API3: 'API3:2023 Broken Object Property Level Authorization',
  API4: 'API4:2023 Unrestricted Resource Consumption',
  API5: 'API5:2023 Broken Function Level Authorization',
  API6: 'API6:2023 Unrestricted Access to Sensitive Business Flows',
  API7: 'API7:2023 Server Side Request Forgery',
  API8: 'API8:2023 Security Misconfiguration',
  API9: 'API9:2023 Improper Inventory Management',
  API10: 'API10:2023 Unsafe Consumption of APIs',
} as const;

export const LLM_RISK = {
  injection: 'OWASP LLM: Prompt injection',
  agency: 'OWASP LLM: Excessive agency',
  output: 'OWASP LLM: Improper output handling',
  disclosure: 'OWASP LLM: Sensitive information disclosure',
  hiddenContext: 'OWASP LLM: System prompt leakage',
  supply: 'OWASP LLM: Supply chain',
  poisoning: 'OWASP LLM: Data and model poisoning',
} as const;
