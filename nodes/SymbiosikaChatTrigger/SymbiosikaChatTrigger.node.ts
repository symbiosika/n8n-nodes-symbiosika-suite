import type {
	IHookFunctions,
	IWebhookFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class SymbiosikaChatTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Symbiosika Chat Trigger',
		name: 'symbiosikaChatTrigger',
		icon: 'file:symbiosika.svg',
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when Symbiosika chat events occur',
		defaults: {
			name: 'Symbiosika Chat Trigger',
		},
		inputs: [],
		outputs: ['main'] as any,
		credentials: [
			{
				name: 'symbiosikaChatApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Name To Display In Symbiosika',
				name: 'webhookName',
				type: 'string',
				default: '',
				description: 'Name of the webhook as it will appear in Symbiosika',
				required: true,
			},
			{
				displayName: 'Events',
				name: 'event',
				type: 'options',
				options: [
					{
						name: 'Chat Output',
						value: 'chatOutput',
						description: 'Triggers when a new message is received',
					},
				],
				default: 'chatOutput',
				required: true,
			},
			{
				displayName: 'Use Organisation-Wide?',
				name: 'organisationWide',
				type: 'boolean',
				default: false,
				description: 'Whether the webhook applies to the entire organisation',
			},
		],
	};

	// @ts-ignore
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const webhookData = this.getWorkflowStaticData('node');
				const event = this.getNodeParameter('event') as string[];
				const credentials = await this.getCredentials('symbiosikaChatApi');

				try {
					const endpoint = `${credentials.apiUrl}/api/v1/organisation/${credentials.organisationId}/webhooks/check`;
					const response = await this.helpers.request({
						method: 'POST',
						uri: endpoint,
						json: true,
						headers: {
							'X-API-KEY': credentials.apiKey,
						},
						body: {
							webhookUrl,
							event,
							webhookId: webhookData.webhookId,
							organisationId: credentials.organisationId,
						},
					});

					return response.exists === true;
				} catch (error) {
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const webhookData = this.getWorkflowStaticData('node');
				const event = this.getNodeParameter('event') as string[];
				const webhookName = this.getNodeParameter('webhookName') as string;
				const credentials = await this.getCredentials('symbiosikaChatApi');

				try {
					const endpoint = `${credentials.apiUrl}/api/v1/organisation/${credentials.organisationId}/webhooks/register/n8n`;
					const response = await this.helpers.request({
						method: 'POST',
						uri: endpoint,
						json: true,
						headers: {
							'X-API-KEY': credentials.apiKey,
						},
						body: {
							webhookUrl,
							event,
							name: webhookName,
							organisationId: credentials.organisationId,
							organisationWide: this.getNodeParameter('organisationWide'),
						},
					});

					if (response.id === undefined) {
						throw new NodeOperationError(
							this.getNode(),
							'Symbiosika API did not return a webhook ID',
						);
					}

					webhookData.webhookId = response.id;
					return true;
				} catch (error) {
					throw new NodeOperationError(this.getNode(), 'Symbiosika webhook registration failed');
				}
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const credentials = await this.getCredentials('symbiosikaChatApi');

				if (webhookData.webhookId !== undefined) {
					try {
						const endpoint = `${credentials.apiUrl}/api/v1/organisation/${credentials.organisationId}/webhooks/${webhookData.webhookId}`;
						await this.helpers.request({
							method: 'DELETE',
							uri: endpoint,
							json: true,
							headers: {
								'X-API-KEY': credentials.apiKey,
							},
						});
					} catch (error) {
						return false;
					}

					delete webhookData.webhookId;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData() as IDataObject;

		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}
