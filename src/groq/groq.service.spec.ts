import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { GroqService } from './groq.service';
import { PaletteEntry } from './groq.types';

interface MockChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  response_format: { type: string };
}

interface MockChatResponse {
  choices: { message: { content: string } }[];
}

const mockCreate = jest.fn<Promise<MockChatResponse>, [MockChatRequest]>();

jest.mock('groq-sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  };
});

const MockedGroq = Groq as unknown as jest.Mock;

function mockCompletion(content: string) {
  return { choices: [{ message: { content } }] };
}

describe('GroqService', () => {
  let service: GroqService;
  let configGet: jest.Mock;

  beforeEach(async () => {
    mockCreate.mockClear();
    MockedGroq.mockClear();
    configGet = jest.fn().mockReturnValue('gsk_test_key');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroqService,
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    service = module.get<GroqService>(GroqService);
  });

  it('short-circuits on an empty palette without calling the Groq API', async () => {
    const result = await service.analyze([]);

    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('drops border-only entries before calling Groq while retaining multi-source entries', async () => {
    const palette: PaletteEntry[] = [
      { hex: '#000000', sources: ['border-color'] },
      { hex: '#ffffff', sources: ['background-color', 'border-color'] },
    ];
    const classified = [
      { hex: '#ffffff', role: 'background', variable: '--color-background' },
    ];
    mockCreate.mockResolvedValue(
      mockCompletion(JSON.stringify({ palette: classified })),
    );

    const result = await service.analyze(palette);

    expect(result).toEqual(classified);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const request = mockCreate.mock.calls[0][0];
    const userMessage = request.messages.find((m) => m.role === 'user');
    expect(userMessage?.content).not.toContain('#000000');
    expect(userMessage?.content).toContain('#ffffff');
  });

  it('classifies a retained palette via a single batched json_schema call', async () => {
    const palette: PaletteEntry[] = [
      { hex: '#111111', sources: ['color'] },
      { hex: '#eeeeee', sources: ['background-color'] },
    ];
    const classified = [
      { hex: '#111111', role: 'text', variable: '--color-text' },
      { hex: '#eeeeee', role: 'background', variable: '--color-background' },
    ];
    mockCreate.mockResolvedValue(
      mockCompletion(JSON.stringify({ palette: classified })),
    );

    const result = await service.analyze(palette);

    expect(result).toEqual(classified);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const request = mockCreate.mock.calls[0][0];
    expect(request.model).toBe('openai/gpt-oss-20b');
    expect(request.response_format.type).toBe('json_schema');
  });

  it('falls back to json_object format when the json_schema request fails', async () => {
    const classified = [
      { hex: '#111111', role: 'text', variable: '--color-text' },
    ];
    mockCreate
      .mockRejectedValueOnce(new Error('schema not supported'))
      .mockResolvedValueOnce(
        mockCompletion(JSON.stringify({ palette: classified })),
      );

    const result = await service.analyze([
      { hex: '#111111', sources: ['color'] },
    ]);

    expect(result).toEqual(classified);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    const firstRequest = mockCreate.mock.calls[0][0];
    const secondRequest = mockCreate.mock.calls[1][0];
    expect(firstRequest.response_format.type).toBe('json_schema');
    expect(secondRequest.response_format.type).toBe('json_object');
  });

  it('rejects with a wrapped error when both the primary and fallback Groq calls fail', async () => {
    mockCreate.mockRejectedValue(new Error('network down'));

    await expect(
      service.analyze([{ hex: '#111111', sources: ['color'] }]),
    ).rejects.toThrow(/Failed to classify palette via Groq/);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('rejects with a wrapped error when the Groq response cannot be parsed into palette entries', async () => {
    mockCreate.mockResolvedValue(mockCompletion('not valid json'));

    await expect(
      service.analyze([{ hex: '#111111', sources: ['color'] }]),
    ).rejects.toThrow(/Failed to classify palette via Groq/);
  });

  it('rejects with a wrapped error when the Groq response is missing required fields', async () => {
    mockCreate.mockResolvedValue(
      mockCompletion(JSON.stringify({ palette: [{ hex: '#111111' }] })),
    );

    await expect(
      service.analyze([{ hex: '#111111', sources: ['color'] }]),
    ).rejects.toThrow(/Failed to classify palette via Groq/);
  });
});
