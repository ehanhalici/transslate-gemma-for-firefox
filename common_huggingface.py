from typing import Tuple
import datetime
import pathlib
import torch
from transformers import AutoModelForImageTextToText, AutoTokenizer

class Translator:
    def __init__(self) -> None:
        model_path = str(pathlib.Path("~/llm-models/translategemma-4b-it/").expanduser())
        
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, use_fast=True)
        
        self.model = AutoModelForImageTextToText.from_pretrained(
            model_path, 
            device_map="cuda",
            torch_dtype=torch.bfloat16,
            attn_implementation="sdpa"#"flash_attention_2"
        )

        self.model = torch.compile(self.model, dynamic=True)

        self.messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "source_lang_code": "en",
                        "target_lang_code": "tr",
                        "text": "",
                    }
                ]
            }
        ]

    def process(self, text: str) -> Tuple[str, datetime.timedelta]:
        start_time = datetime.datetime.now()
        
        self.messages[0]['content'][0]['text'] = text

        inputs = self.tokenizer.apply_chat_template(
            self.messages,
            tokenize=True,
            add_generation_prompt=True,
            return_dict=True,
            return_tensors="pt"
        ).to(self.model.device)
        
        input_len = inputs['input_ids'].shape[1]

        with torch.inference_mode():
            generation = self.model.generate(
                **inputs,
                do_sample=False,
                max_new_tokens=len(text) * 4,
                pad_token_id=self.tokenizer.eos_token_id,
                use_cache=True
            )

        generation = generation[0][input_len:]
        translation = self.tokenizer.decode(generation, skip_special_tokens=True)
        
        diff_time = datetime.datetime.now() - start_time
        return translation, diff_time
