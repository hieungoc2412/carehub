package vn.vietduc.carehubbackend.config;

import org.hibernate.boot.model.FunctionContributions;
import org.hibernate.boot.model.FunctionContributor;
import org.hibernate.query.sqm.produce.function.FunctionParameterType;
import org.hibernate.type.StandardBasicTypes;
import vn.vietduc.carehubbackend.common.SearchText;

/** Keeps nullable search arguments on the database function's text overload. */
public class SearchFunctionContributor implements FunctionContributor {
    @Override
    public void contributeFunctions(FunctionContributions contributions) {
        // IS NULL predicates can make Hibernate bind a shared null parameter as VARBINARY.
        // Cast at the function boundary so every JPQL/Criteria caller uses the text overload.
        contributions.getFunctionRegistry().patternDescriptorBuilder(
                        SearchText.SQL_FUNCTION, SearchText.SQL_FUNCTION + "(cast(?1 as text))")
                .setExactArgumentCount(1)
                .setParameterTypes(FunctionParameterType.STRING)
                .setInvariantType(contributions.getTypeConfiguration().getBasicTypeRegistry().resolve(StandardBasicTypes.STRING))
                .register();
    }
}
