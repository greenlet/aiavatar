targetScope = 'resourceGroup'

@description('Name of the azd environment. Used to seed resource names.')
param environmentName string

@description('Azure region.')
param location string

param azureOpenAiEndpoint string
@secure()
param azureOpenAiApiKey string
param azureOpenAiDeployment string
param azureOpenAiApiVersion string
@secure()
param azureSpeechKey string
param azureSpeechRegion string
param allowedOrigin string
param imageTag string

// Short, unique suffix so names stay <= length limits and stable per resource group.
var resourceToken = toLower(uniqueString(subscription().id, resourceGroup().id, environmentName))
var shortToken = substring(resourceToken, 0, 8)

var lawName    = 'log-${environmentName}-${shortToken}'
var acrName    = toLower('acr${replace(environmentName, '-', '')}${shortToken}')
var envName    = 'cae-${environmentName}-${shortToken}'
var appName    = 'ca-${environmentName}-${shortToken}'
// Placeholder image used on first deploy before the real image exists in ACR.
var placeholderImage = 'mcr.microsoft.com/k8se/quickstart:latest'

// ----- Log Analytics -----
resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: lawName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    features: { enableLogAccessUsingOnlyResourcePermissions: true }
  }
}

// ----- Azure Container Registry (Basic, admin user enabled per user request: no MI) -----
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: acrName
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
  }
}

// ----- Container Apps Environment -----
resource caEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// Decide which image to point at:
//  - first deploy (no tag set): placeholder hello-world image so the app provisions cleanly
//  - subsequent deploys: <acr>.azurecr.io/aiavatar/web:<tag>  pushed by azd
var fullImage = imageTag == 'latest' || empty(imageTag)
  ? placeholderImage
  : '${acr.properties.loginServer}/aiavatar/web:${imageTag}'

// ----- Container App -----
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  tags: {
    // azd matches services in azure.yaml to container apps via this tag.
    'azd-service-name': 'web'
  }
  properties: {
    managedEnvironmentId: caEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
        traffic: [
          { latestRevision: true, weight: 100 }
        ]
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: [
        { name: 'registry-password',     value: acr.listCredentials().passwords[0].value }
        { name: 'azure-openai-api-key',  value: azureOpenAiApiKey }
        { name: 'azure-speech-key',      value: azureSpeechKey }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: fullImage
          resources: {
            cpu: json('0.5')
            memory: '1.0Gi'
          }
          env: [
            { name: 'AZURE_OPENAI_ENDPOINT',    value: azureOpenAiEndpoint }
            { name: 'AZURE_OPENAI_API_KEY',     secretRef: 'azure-openai-api-key' }
            { name: 'AZURE_OPENAI_DEPLOYMENT',  value: azureOpenAiDeployment }
            { name: 'AZURE_OPENAI_API_VERSION', value: azureOpenAiApiVersion }
            { name: 'AZURE_SPEECH_KEY',         secretRef: 'azure-speech-key' }
            { name: 'AZURE_SPEECH_REGION',      value: azureSpeechRegion }
            { name: 'ALLOWED_ORIGIN',           value: allowedOrigin }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/api/health', port: 8000 }
              initialDelaySeconds: 10
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: { path: '/api/health', port: 8000 }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        rules: [
          {
            name: 'http-scaling'
            http: { metadata: { concurrentRequests: '20' } }
          }
        ]
      }
    }
  }
}

output registryLoginServer string = acr.properties.loginServer
output registryName string = acr.name
output containerAppName string = app.name
output containerAppFqdn string = app.properties.configuration.ingress.fqdn
