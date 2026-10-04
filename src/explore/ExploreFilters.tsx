import { Text, View } from "react-native";
import { BrowseSheet, Choice, browseStyles } from "@/components/ui/Browse";
import { FlowFooter } from "@/components/ui/Flow";
export type ExploreOptions = {
  token: "all" | "USDC" | "SKR";
  radius: number;
  sort: "nearest" | "ending" | "reward";
};
export const defaultExploreOptions: ExploreOptions = { token: "all", radius: 25, sort: "nearest" };
export function ExploreFilters({
  value,
  onChange,
  onApply,
  onClose,
  count,
  local = true,
}: {
  value: ExploreOptions;
  onChange: (value: ExploreOptions) => void;
  onApply: () => void;
  onClose: () => void;
  count: number;
  local?: boolean;
}) {
  return (
    <BrowseSheet
      visible
      title="Find your next bounty"
      onClose={onClose}
      footer={
        <FlowFooter
          label={`Show ${count} ${count === 1 ? "bounty" : "bounties"}`}
          onPress={onApply}
          secondary={{ label: "Reset filters", onPress: () => onChange(defaultExploreOptions) }}
        />
      }
    >
      {local ? <View>
        <Text style={browseStyles.groupLabel}>Distance from you</Text>
        <View style={browseStyles.choiceWrap}>
          {[5, 10, 25].map((radius) => (
            <Choice
              key={radius}
              label={`${radius} km`}
              selected={value.radius === radius}
              onPress={() => onChange({ ...value, radius })}
            />
          ))}
        </View>
      </View> : null}
      <View>
        <Text style={browseStyles.groupLabel}>Reward token</Text>
        <View style={browseStyles.choiceWrap}>
          {(["all", "USDC", "SKR"] as const).map((token) => (
            <Choice
              key={token}
              label={token === "all" ? "All tokens" : token}
              selected={value.token === token}
              onPress={() =>
                onChange({
                  ...value,
                  token,
                  sort: token === "all" && value.sort === "reward" ? "nearest" : value.sort,
                })
              }
            />
          ))}
        </View>
      </View>
      <View>
        <Text style={browseStyles.groupLabel}>Sort by</Text>
        <View style={browseStyles.choiceWrap}>
          <Choice
            label={local ? "Nearest" : "Newest"}
            selected={value.sort === "nearest"}
            onPress={() => onChange({ ...value, sort: "nearest" })}
          />
          <Choice
            label="Ending soon"
            selected={value.sort === "ending"}
            onPress={() => onChange({ ...value, sort: "ending" })}
          />
          {value.token !== "all" ? (
            <Choice
              label="Highest reward"
              selected={value.sort === "reward"}
              onPress={() => onChange({ ...value, sort: "reward" })}
            />
          ) : null}
        </View>
        <Text style={[browseStyles.groupLabel, { marginTop: 12, marginBottom: 0, lineHeight: 20 }]}>
          Select one token to compare reward amounts. Filters apply to the results currently loaded.
        </Text>
      </View>
    </BrowseSheet>
  );
}
