import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SymbiosikaChatApi implements ICredentialType {
	name = 'symbiosikaChatApi';
	displayName = 'Symbiosika Chat API';
	documentationUrl = 'https://symbiosika.de';
	properties: INodeProperties[] = [
		{
			displayName: 'API URL',
			name: 'apiUrl',
			type: 'string',
			default: '',
			placeholder: 'https://your-instance.symbiosika.de',
			description: 'The URL of your Symbiosika Suite instance.',
			required: true,
		},
		{
			displayName: 'Organisation ID',
			name: 'organisationId',
			type: 'string',
			default: '',
			required: true,
			description: 'The ID of your organisation',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-KEY': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.apiUrl}}',
			url: '/api/v1/ping',
			method: 'GET',
		},
	};
}
