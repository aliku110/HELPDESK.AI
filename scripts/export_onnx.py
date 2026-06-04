#!/usr/bin/env python3
"""
Export SentenceTransformer model to ONNX format.
Usage: python export_onnx.py
Output: backend/models/onnx/duplicate_model.onnx
"""
import os, sys

def export_onnx():
    from sentence_transformers import SentenceTransformer
    import torch

    model_name = os.environ.get("SENTENCE_TRANSFORMER_MODEL_PATH", "all-MiniLM-L6-v2")
    output_path = os.path.join(
        os.path.dirname(__file__),
        "..", "models", "onnx", "duplicate_model.onnx"
    )
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    print(f"[ONNX Export] Loading model: {model_name}")
    model = SentenceTransformer(model_name)

    # Get the underlying transformer model
    print("[ONNX Export] Creating ONNX export sample...")
    dummy_text = ["dummy input for shape inference"]
    embedding = model.encode(dummy_text, convert_to_numpy=False)
    seq_len = embedding.shape[0]
    dim = embedding.shape[1]

    print(f"[ONNX Export] Embedding dimension: {dim}, Sequence length: {seq_len}")

    # Export using the model's encode function
    # We use torch.onnx.export with a wrapper to handle the batch encoding
    class EncoderWrapper(torch.nn.Module):
        def __init__(self, st_model):
            super().__init__()
            self.model = st_model

        def forward(self, input_ids, attention_mask):
            # Pass through sentence-transformers internals
            out = self.model.auto_model(input_ids=input_ids, attention_mask=attention_mask)
            # Mean pooling
            token_embeddings = out.last_hidden_state
            input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
            sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
            sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
            return sum_embeddings / sum_mask

    # Actually, let's use a simpler approach: export just the raw transformer
    try:
        # Method 1: Direct export with dynamic axes
        print("[ONNX Export] Exporting model (this may take a minute)...")
        
        # Create dummy inputs matching the model's tokenizer
        tokenizer = model.tokenizer
        dummy = tokenizer("export test", padding=True, truncation=True, max_length=256, return_tensors="pt")
        
        wrapper = EncoderWrapper(model)
        wrapper.eval()

        torch.onnx.export(
            wrapper,
            (dummy["input_ids"], dummy["attention_mask"]),
            output_path,
            input_names=["input_ids", "attention_mask"],
            output_names=["embedding"],
            dynamic_axes={
                "input_ids": {0: "batch_size"},
                "attention_mask": {0: "batch_size"},
                "embedding": {0: "batch_size"},
            },
            opset_version=14,
            do_constant_folding=True,
        )
        print(f"[ONNX Export] SUCCESS! Saved to: {output_path}")
        print(f"[ONNX Export] File size: {os.path.getsize(output_path) / 1024 / 1024:.1f} MB")
        return output_path
    except Exception as e:
        print(f"[ONNX Export] Standard method failed: {e}")
        print("[ONNX Export] Falling back to optimum library...")
        try:
            from optimum.exporters.onnx import main as optimum_main
            import subprocess
            result = subprocess.run([
                sys.executable, "-m", "optimum.exporters.onnx",
                "--model", model_name,
                "--output", output_path,
            ], capture_output=True, text=True)
            print("[ONNX Export] Optimum output:", result.stdout[-500:] if result.stdout else "")
            if result.returncode == 0:
                print(f"[ONNX Export] SUCCESS via optimum! File: {output_path}")
                return output_path
            else:
                print(f"[ONNX Export] Optimum failed: {result.stderr[-300:]}")
        except ImportError:
            print("[ONNX Export] optimum not installed. Install with: pip install optimum")
        return None

if __name__ == "__main__":
    result = export_onnx()
    sys.exit(0 if result else 1)
