import { IntentResult } from './conversation.types';

export interface IIntentClassifier {
  classify(message: string): Promise<IntentResult>;
}

export const INTENT_CLASSIFIER_TOKEN = 'INTENT_CLASSIFIER_TOKEN';
