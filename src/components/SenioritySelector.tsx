import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SeniorityLevel, SENIORITY_OPTIONS, SPECIALTY_OPTIONS } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../styles/theme';

interface Props {
  seniority: SeniorityLevel | null;
  onSeniorityChange: (value: SeniorityLevel) => void;
  specialties: string[];
  onSpecialtiesChange: (value: string[]) => void;
  experienceYears: number | null;
  onExperienceYearsChange: (value: number | null) => void;
}

export default function SenioritySelector({
  seniority,
  onSeniorityChange,
  specialties,
  onSpecialtiesChange,
  experienceYears,
  onExperienceYearsChange,
}: Props) {
  const { theme } = useTheme();

  const toggleSpecialty = (tag: string) => {
    if (specialties.includes(tag)) {
      onSpecialtiesChange(specialties.filter((s) => s !== tag));
    } else {
      onSpecialtiesChange([...specialties, tag]);
    }
  };

  const experienceOptions = [
    { value: 0, label: '< 1 ano' },
    { value: 1, label: '1-2 anos' },
    { value: 3, label: '3-5 anos' },
    { value: 6, label: '6-10 anos' },
    { value: 11, label: '10+ anos' },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: theme.label }]}>Nível de Senioridade</Text>
      <Text style={[styles.sectionHint, { color: theme.textLight }]}>
        Como você classifica sua experiência profissional?
      </Text>
      <View style={styles.seniorityRow}>
        {SENIORITY_OPTIONS.map((opt) => {
          const isActive = seniority === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.seniorityChip,
                { borderColor: theme.border, backgroundColor: theme.inputBg },
                isActive && { borderColor: theme.primary, backgroundColor: theme.primary + '18' },
              ]}
              onPress={() => onSeniorityChange(opt.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.seniorityChipLabel,
                  { color: theme.textDark },
                  isActive && { color: theme.primary, fontWeight: '700' },
                ]}
              >
                {opt.label}
              </Text>
              <Text
                style={[
                  styles.seniorityChipDesc,
                  { color: theme.textLight },
                  isActive && { color: theme.primary },
                ]}
                numberOfLines={2}
              >
                {opt.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: theme.label, marginTop: 20 }]}>
        Especialidades
      </Text>
      <Text style={[styles.sectionHint, { color: theme.textLight }]}>
        Selecione uma ou mais áreas que você domina
      </Text>
      <View style={styles.specialtiesGrid}>
        {SPECIALTY_OPTIONS.map((tag) => {
          const isSelected = specialties.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[
                styles.specialtyTag,
                { borderColor: theme.border, backgroundColor: theme.inputBg },
                isSelected && { borderColor: theme.primary, backgroundColor: theme.primary + '18' },
              ]}
              onPress={() => toggleSpecialty(tag)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.specialtyTagText,
                  { color: theme.textDark },
                  isSelected && { color: theme.primary, fontWeight: '700' },
                ]}
              >
                {tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: theme.label, marginTop: 20 }]}>
        Tempo de Experiência
      </Text>
      <View style={styles.experienceRow}>
        {experienceOptions.map((opt) => {
          const isActive = experienceYears === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.experienceChip,
                { borderColor: theme.border, backgroundColor: theme.inputBg },
                isActive && { borderColor: theme.primary, backgroundColor: theme.primary + '18' },
              ]}
              onPress={() => onExperienceYearsChange(isActive ? null : opt.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.experienceChipText,
                  { color: theme.textDark },
                  isActive && { color: theme.primary, fontWeight: '700' },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  seniorityRow: {
    gap: 10,
  },
  seniorityChip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  seniorityChipLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  seniorityChipDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  specialtiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  specialtyTag: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  specialtyTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  experienceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  experienceChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  experienceChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
