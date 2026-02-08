import torch
import torch.nn as nn
from torchvision import models

# -------- Spatial Self-Attention (CBAM-style) --------
class SpatialAttention(nn.Module):
    def __init__(self, kernel_size=7):
        super().__init__()
        self.conv = nn.Conv2d(2, 1, kernel_size=kernel_size, padding=kernel_size//2)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        # x: [B, C, H, W]
        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        attn = torch.cat([avg_out, max_out], dim=1)  # [B, 2, H, W]
        attn = self.sigmoid(self.conv(attn))
        return x * attn


class ResNetLSTM(nn.Module):
    def __init__(self, num_classes, hidden_size=256):
        super().__init__()

        self.attn = SpatialAttention()

        base_model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        self.cnn = nn.Sequential(*list(base_model.children())[:-1])  # remove FC
        self.feature_dim = 512

        self.lstm = nn.LSTM(
            input_size=self.feature_dim,
            hidden_size=hidden_size,
            num_layers=1,
            batch_first=True,
            bidirectional=True
        )

        self.embedding = nn.Sequential(
            nn.Linear(hidden_size * 2, 128),
            nn.ReLU(),
            nn.Dropout(0.3)
        )

        self.classifier = nn.Linear(128, num_classes)

    def forward(self, x, return_embedding=False):
        """
        x:
        - Images: [B, 1, 3, 224, 224]
        - Video:  [B, T, 3, 224, 224]
        """
        B, T, C, H, W = x.shape
        x = x.view(B * T, C, H, W)

        # 🔎 Self-Attention on image
        x = self.attn(x)

        # 🧠 CNN features
        features = self.cnn(x).squeeze(-1).squeeze(-1)  # [B*T, 512]
        features = features.view(B, T, -1)

        # 🧵 LSTM global context
        lstm_out, _ = self.lstm(features)
        global_feat = lstm_out[:, -1, :]  # last timestep

        # 🧬 128-d embedding
        emb = self.embedding(global_feat)

        # 🎯 Final logits
        logits = self.classifier(emb)

        if return_embedding:
            return emb, logits

        return logits
