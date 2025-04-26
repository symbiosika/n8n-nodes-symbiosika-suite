import type {
	IHookFunctions,
	IWebhookFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class SymbiosikaToolTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Symbiosika Tool Trigger',
		name: 'symbiosikaToolTrigger',
		icon: 'file:symbiosika.svg',
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when Symbiosika tool events occur',
		defaults: {
			name: 'Symbiosika Tool Trigger',
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
			// Organisation Selection
			{
				displayName: 'Organisation Name or ID',
				name: 'organisationId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getOrganisations',
				},
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				required: true,
			},
			{
				displayName: 'Tool Name',
				name: 'toolName',
				type: 'string',
				default: '',
				description: 'Name of the tool as it will appear in Symbiosika',
				required: true,
			},
			{
				displayName: 'Tool Description',
				name: 'toolDescription',
				type: 'string',
				default: '',
				description: 'Description of what this tool does',
				required: true,
			},
			{
				displayName: 'Parameters',
				name: 'parameters',
				placeholder: 'Add Parameter',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: { values: [] },
				options: [
					{
						name: 'values',
						displayName: 'Parameter',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Name of the parameter',
								required: true,
							},
							{
								displayName: 'Type',
								name: 'type',
								type: 'options',
								options: [
									{
										name: 'String',
										value: 'string',
									},
									{
										name: 'Number',
										value: 'number',
									},
									{
										name: 'Integer',
										value: 'integer',
									},
									{
										name: 'Boolean',
										value: 'boolean',
									},
									{
										name: 'Array',
										value: 'array',
									},
									{
										name: 'Object',
										value: 'object',
									},
									{
										name: 'Null',
										value: 'null',
									},
									{
										name: 'Date',
										value: 'date',
									},
									{
										name: 'RegExp',
										value: 'regexp',
									},
									{
										name: 'Function',
										value: 'function',
									},
									{
										name: 'Undefined',
										value: 'undefined',
									},
								],
								default: 'string',
								description: 'Type of the parameter (JSON7 compatible)',
								required: true,
							},
							{
								displayName: 'Required',
								name: 'required',
								type: 'boolean',
								default: false,
								description: 'Whether the parameter is required',
								required: true,
							},
						],
					},
				],
			},
			{
				displayName: 'Use Organisation-Wide?',
				name: 'organisationWide',
				type: 'boolean',
				default: false,
				description: 'Whether the tool applies to the entire organisation',
			},
		],
	};

	methods = {
		loadOptions: {
			async getOrganisations(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('symbiosikaChatApi');
				const endpoint = `${credentials.apiUrl}/api/v1/user/organisations`;

				try {
					const response = await this.helpers.request({
						method: 'GET',
						uri: endpoint,
						json: true,
						headers: {
							'X-API-KEY': credentials.apiKey,
						},
					});

					if (!Array.isArray(response)) {
						throw new NodeOperationError(
							this.getNode(),
							'Invalid response format for organisations',
						);
					}

					return response.map((org) => ({
						name: `${org.name} (${org.role})`,
						value: org.organisationId,
					}));
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to load organisations: ${error.message}`,
					);
				}
			},
		},
	};

	// @ts-ignore
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const webhookData = this.getWorkflowStaticData('node');
				const credentials = await this.getCredentials('symbiosikaChatApi');
				const organisationId = this.getNodeParameter('organisationId') as string;

				try {
					const endpoint = `${credentials.apiUrl}/api/v1/organisation/${organisationId}/webhooks/check`;
					const response = await this.helpers.request({
						method: 'POST',
						uri: endpoint,
						json: true,
						headers: {
							'X-API-KEY': credentials.apiKey,
						},
						body: {
							webhookUrl,
							webhookId: webhookData.webhookId,
							organisationId,
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
				const credentials = await this.getCredentials('symbiosikaChatApi');
				const organisationId = this.getNodeParameter('organisationId') as string;
				const toolName = this.getNodeParameter('toolName') as string;
				const toolDescription = this.getNodeParameter('toolDescription') as string;
				const parameters = this.getNodeParameter('parameters.values', []) as Array<{
					name: string;
					type: string;
					required: boolean;
				}>;

				try {
					const endpoint = `${credentials.apiUrl}/api/v1/organisation/${organisationId}/webhooks/register/n8n`;
					const response = await this.helpers.request({
						method: 'POST',
						uri: endpoint,
						json: true,
						headers: {
							'X-API-KEY': credentials.apiKey,
						},
						body: {
							event: 'tool',
							webhookUrl,
							name: toolName,
							meta: {
								description: toolDescription,
								parameters,
							},
							organisationId,
							organisationWide: this.getNodeParameter('organisationWide'),
						},
					});

					if (response.id === undefined) {
						throw new NodeOperationError(this.getNode(), 'Symbiosika API did not return a tool ID');
					}

					webhookData.webhookId = response.id;
					return true;
				} catch (error) {
					throw new NodeOperationError(this.getNode(), 'Symbiosika tool registration failed');
				}
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const credentials = await this.getCredentials('symbiosikaChatApi');
				const organisationId = this.getNodeParameter('organisationId') as string;

				if (webhookData.webhookId !== undefined) {
					try {
						const endpoint = `${credentials.apiUrl}/api/v1/organisation/${organisationId}/webhooks/${webhookData.webhookId}`;
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
