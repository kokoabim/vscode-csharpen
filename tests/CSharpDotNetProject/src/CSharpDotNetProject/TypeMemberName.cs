namespace CSharpDotNetProject;

public class TypeMemberName
{
    public const string NAME_CUSTOMER = "Foo";

    #region properties
    public DateTime Created { get; }
    public IDictionary<long, long> Mapping { get; }
    public double Price { get; }
    #endregion

    private readonly Product _product;
}

class Product
{
}