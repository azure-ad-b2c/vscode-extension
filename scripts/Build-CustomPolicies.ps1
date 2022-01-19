<#
.SYNOPSIS
   Build the Trusted Framework policies for each defined environment
.DESCRIPTION
   The script replaces the keys with the value configure in the appsettings.json file contains the keys with their values for each environment:
    •Name - contains the environment name which VS code extension uses to create the environment folder (under the environments parent folder). Use your operation system legal characters only.
    •Tenant - specifies the tenant name, such as contoso.onmicrosoft.com. In the policy file, use the format of Settings:Tenant, for example {Settings:Tenant}.
    •Production - (boolean) is preserved for future use, indicating whether the environment is a production one.
    •PolicySettings - contains a collection of key-value pair with your settings. In the policy file, use the format of Settings: and the key name, for example {Settings:FacebookAppId}.
.NOTES    
    ChangeLog:
        1.0.0 - Converted VSCODE script to Powrshell for Build Server usage - https://github.com/azure-ad-b2c/vscode-extension/blob/master/src/PolicyBuild.ts
.PREREQUISITES
   The following resources must be pre created before running the script
   1. appsettings.json file exists in proper format        
#>
param(
#File Path containing the appsettings.json and the XML policy files
[Parameter(Mandatory = $true)]
[string]
$FilePath,

[Parameter(Mandatory = $false)]
[string]
$Environment
)

try{
    #Check if appsettings.json is existed under for root folder        
    $AppSettingsFile = Join-Path $FilePath "appsettings.json"

    #Create app settings file with default values
    $AppSettingsJson = Get-Content -Raw -Path $AppSettingsFile | ConvertFrom-Json

    #Read all policy files from the root directory            
    $XmlPolicyFiles = Get-ChildItem -Path $FilePath -Filter *.xml
    Write-Verbose "Files found: $XmlPolicyFiles"

    #Get the app settings                        
    $EnvironmentsRootPath = Join-Path $FilePath ($AppSettingsJson.EnvironmentsFolder ?? "Environments")

    #Ensure environments folder exists
    if((Test-Path -Path $EnvironmentsRootPath -PathType Container) -ne $true)
    {
        New-Item -ItemType Directory -Force -Path $EnvironmentsRootPath | Out-Null
    }                                    

    #Iterate through environments  
    foreach($entry in $AppSettingsJson.Environments)
    {
        if ($Environment -and $entry.Name -ne $Environment) {
          Write-Verbose "Skipping environment: '$($entry.Name)'"
          continue
        }
        
        Write-Verbose "ENVIRONMENT: $($entry.Name)"

        if($null -eq $entry.PolicySettings){
            Write-Error "Can't generate '$($entry.Name)' environment policies. Error: Accepted PolicySettings element is missing. You may use old version of the appSettings.json file. For more information, see [App Settings](https://github.com/yoelhor/aad-b2c-vs-code-extension/blob/master/README.md#app-settings)"
        }
        else {
            $environmentRootPath = Join-Path $EnvironmentsRootPath $entry.Name

            if((Test-Path -Path $environmentRootPath -PathType Container) -ne $true)
            {
                New-Item -ItemType Directory -Force -Path $environmentRootPath | Out-Null
            }    

            #Iterate through the list of settings
            foreach($file in $XmlPolicyFiles)
            {
                Write-Verbose "FILE: $($entry.Name) - $file"

                $policContent = Get-Content (Join-Path $FilePath $file) | Out-String

                #Replace the tenant name
                $policContent = $policContent -replace "\{Settings:Tenant\}", $entry.Tenant

                #Replace the rest of the policy settings
                $policySettingsHash = @{}; #ugly hash conversion from psobject so we can access json properties via key
                $entry.PolicySettings.psobject.properties | ForEach-Object{ $policySettingsHash[$_.Name] = $_.Value }
                foreach($key in $policySettingsHash.Keys)
                {
                    Write-Verbose "KEY: $key VALUE: $($policySettingsHash[$key])"
                    $policContent = $policContent -replace "\{Settings:$($key)\}", $policySettingsHash[$key]
                }

                #Save the  policy
                $policContent | Set-Content ( Join-Path $environmentRootPath $file )            
            }
        }

        Write-Output "You policies successfully exported and stored under the Environment folder ($($entry.Name))."
    }
}
catch{
    Write-Error $_
}
