targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the azd environment. Used to derive resource names.')
param environmentName string

@minLength(1)
@description('Primary Azure region for all resources.')
param location string

@description('Azure OpenAI endpoint (existing resource to reuse).')
param azureOpenAiEndpoint string

@description('Azure OpenAI API key (existing resource to reuse).')
@secure()
param azureOpenAiApiKey string

@description('Azure OpenAI deployment name (e.g. gpt-5.4).')
param azureOpenAiDeployment string

@description('Azure OpenAI API version (e.g. 2024-12-01-preview).')
param azureOpenAiApiVersion string

@description('Azure Speech key (existing resource to reuse).')
@secure()
param azureSpeechKey string

@description('Azure Speech region (e.g. westeurope).')
param azureSpeechRegion string

@description('Allowed origin for CORS. Use "*" since frontend is served from the same origin.')
param allowedOrigin string = '*'

@description('Container image tag to deploy. azd overrides this on each deploy.')
param imageTag string = 'latest'

// Deterministic resource group name from the env name.
var resourceGroupName = 'rg-${environmentName}'

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: {
    'azd-env-name': environmentName
  }
}

module resources 'resources.bicep' = {
  name: 'resources-${environmentName}'
  scope: rg
  params: {
    environmentName: environmentName
    location: location
    azureOpenAiEndpoint: azureOpenAiEndpoint
    azureOpenAiApiKey: azureOpenAiApiKey
    azureOpenAiDeployment: azureOpenAiDeployment
    azureOpenAiApiVersion: azureOpenAiApiVersion
    azureSpeechKey: azureSpeechKey
    azureSpeechRegion: azureSpeechRegion
    allowedOrigin: allowedOrigin
    imageTag: imageTag
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.registryLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = resources.outputs.registryName
output AZURE_CONTAINER_APP_NAME string = resources.outputs.containerAppName
output AZURE_CONTAINER_APP_FQDN string = resources.outputs.containerAppFqdn
output WEB_URI string = 'https://${resources.outputs.containerAppFqdn}'
