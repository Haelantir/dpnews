---
title: 인간 피드백 강화학습 (RLHF)
date: "2026-04-28"
relatedKnowledge:
  - large-language-model
---

## 개요

인간 피드백 강화학습(Reinforcement Learning from Human Feedback, RLHF)은 AI 모델이 인간의 선호도에 맞게 행동하도록 훈련하는 기법이다. ChatGPT, Claude 등 주요 AI 어시스턴트의 핵심 훈련 방식으로 사용된다.

## 작동 방식

RLHF는 세 단계로 진행된다.

1. **지도 학습(SFT)**: 인간이 작성한 고품질 답변으로 기반 모델을 파인튜닝한다.
2. **보상 모델 학습**: 인간 평가자가 여러 답변 중 더 나은 것을 선택하면, 이 선호 데이터로 보상 모델(Reward Model)을 훈련한다.
3. **강화학습 최적화**: PPO(Proximal Policy Optimization) 등의 알고리즘을 사용해 보상 모델의 점수를 최대화하는 방향으로 언어 모델을 업데이트한다.

## 한계와 발전

보상 모델 자체가 인간 편향을 학습할 수 있다는 점, 그리고 평가자의 주관이 개입된다는 점이 한계로 지적된다. 이를 개선하기 위해 **RLAIF(AI 피드백 강화학습)**, **DPO(Direct Preference Optimization)** 등의 대안적 방법론이 연구되고 있다.
